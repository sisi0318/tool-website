import { getNodeDefinition } from "../canvas/registry"
import { readLocalStorage, removeLocalStorage, writeLocalStorage } from "../safe-storage"
import { isStructurallyValid } from "./tree"
import type { Journey, JourneyNode, JourneyStep, SharedJourneyPath } from "./types"

const SAVES_KEY = "journey-saves"
const DRAFT_KEY = "journey-draft"
const MAX_PERSISTED_VALUE_CHARS = 64 * 1024
const MAX_SHARED_ROOT_TEXT = 2 * 1024
/** 分享链接的编码上限,超出后多数浏览器/聊天工具会截断 */
export const MAX_SHARED_PAYLOAD_CHARS = 8 * 1024

// ---------- 通用:unicode 安全的 base64url ----------

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function fromBase64Url(encoded: string): string | null {
  try {
    const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/")
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")
    const binary = atob(padded)
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes)
  } catch {
    return null
  }
}

/** 剥离配置里不可序列化的值(File/Blob/函数/undefined) */
export function sanitizeConfig(config: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(config)) {
    if (value === undefined || typeof value === "function") continue
    if (typeof Blob !== "undefined" && value instanceof Blob) continue
    try {
      JSON.stringify(value)
      result[key] = value
    } catch {
      // 循环引用等异常值直接丢弃
    }
  }
  return result
}

// ---------- URL 分享(仅路径,不含数据本体) ----------

/** 剥离标记为 sensitive 的长期凭据;未注册的工具原样保留(导入时会被拦下) */
export function redactSensitiveConfig(
  tool: string,
  config: Record<string, unknown>,
): Record<string, unknown> {
  const definition = getNodeDefinition(tool)
  if (!definition) return config
  const sensitiveIds = new Set(
    definition.config.filter((field) => field.sensitive).map((field) => field.id),
  )
  if (sensitiveIds.size === 0) return config
  return Object.fromEntries(
    Object.entries(config).filter(([key]) => !sensitiveIds.has(key)),
  )
}

/** 超出 URL 承载上限时返回 null,由调用方提示用户 */
export function encodeSharedPath(
  name: string,
  steps: JourneyStep[],
  rootText?: string,
): string | null {
  const payload: SharedJourneyPath = {
    v: 1,
    name,
    steps: steps.map((step) => ({
      ...step,
      config: redactSensitiveConfig(step.tool, sanitizeConfig(step.config)),
    })),
  }
  if (typeof rootText === "string" && rootText.length > 0 && rootText.length <= MAX_SHARED_ROOT_TEXT) {
    payload.rootText = rootText
  }
  const encoded = `j=${toBase64Url(JSON.stringify(payload))}`
  return encoded.length > MAX_SHARED_PAYLOAD_CHARS ? null : encoded
}

function isValidStep(value: unknown): value is JourneyStep {
  if (value === null || typeof value !== "object") return false
  const step = value as Record<string, unknown>
  return (
    typeof step.tool === "string" &&
    step.config !== null &&
    typeof step.config === "object" &&
    typeof step.outputPort === "string"
  )
}

/** 接受完整 hash("#j=…")或裸编码,非法输入返回 null */
export function decodeSharedPath(hash: string): SharedJourneyPath | null {
  const raw = hash.replace(/^#/, "")
  const encoded = raw.startsWith("j=") ? raw.slice(2) : raw
  if (!encoded) return null

  const json = fromBase64Url(encoded)
  if (!json) return null

  try {
    const parsed: unknown = JSON.parse(json)
    if (parsed === null || typeof parsed !== "object") return null
    const candidate = parsed as Record<string, unknown>
    if (candidate.v !== 1 || !Array.isArray(candidate.steps)) return null
    if (!candidate.steps.every(isValidStep)) return null
    return {
      v: 1,
      name: typeof candidate.name === "string" ? candidate.name : "",
      steps: candidate.steps as JourneyStep[],
      ...(typeof candidate.rootText === "string" ? { rootText: candidate.rootText } : {}),
    }
  } catch {
    return null
  }
}

// ---------- 导入分享路径前的安全审查 ----------

export type SharedStepIssue = "unknown-tool" | "network-tool" | "manual-tool"

export interface SharedStepReview {
  step: JourneyStep
  /** 工具的展示名,未注册时回退到 type */
  label: string
  issue?: SharedStepIssue
}

export interface SharedPathReview {
  steps: SharedStepReview[]
  /** 存在任一不可执行的步骤时为 true,此时整条路径都不应自动运行 */
  blocked: boolean
}

/**
 * 分享链接来自站外,等同不可信输入:未注册的工具无法执行,
 * 会发网络请求(network)或需人工确认(manual)的工具则可能被用来把
 * 用户粘贴的数据带出去,一律拒绝执行。
 */
export function reviewSharedPath(shared: SharedJourneyPath): SharedPathReview {
  const steps = shared.steps.map((step) => {
    const definition = getNodeDefinition(step.tool)
    if (!definition) return { step, label: step.tool, issue: "unknown-tool" as const }
    if (definition.network) return { step, label: definition.label, issue: "network-tool" as const }
    if (definition.executionMode === "manual") {
      return { step, label: definition.label, issue: "manual-tool" as const }
    }
    return { step, label: definition.label }
  })
  return { steps, blocked: steps.some((entry) => entry.issue !== undefined) }
}

// ---------- localStorage 持久化(值按可序列化性降级) ----------

interface PersistedNode extends Omit<JourneyNode, "value"> {
  value?: unknown
}

export interface PersistedJourney extends Omit<Journey, "nodes"> {
  nodes: Record<string, PersistedNode>
}

function persistValue(value: unknown): { value?: unknown; valueMissing?: boolean } {
  if (typeof value === "number" || typeof value === "boolean") return { value }
  if (typeof value === "string") {
    return value.length <= MAX_PERSISTED_VALUE_CHARS ? { value } : { valueMissing: true }
  }
  if (typeof Blob !== "undefined" && value instanceof Blob) return { valueMissing: true }
  try {
    const json = JSON.stringify(value)
    return json !== undefined && json.length <= MAX_PERSISTED_VALUE_CHARS
      ? { value }
      : { valueMissing: true }
  } catch {
    return { valueMissing: true }
  }
}

export function persistJourney(journey: Journey): PersistedJourney {
  const nodes: Record<string, PersistedNode> = {}
  for (const [id, node] of Object.entries(journey.nodes)) {
    const { value, ...rest } = node
    const persisted = persistValue(value)
    nodes[id] = {
      ...rest,
      via: node.via ? { ...node.via, config: sanitizeConfig(node.via.config) } : null,
      ...(persisted.valueMissing ? { valueMissing: true } : { value: persisted.value }),
    }
  }
  return { ...journey, nodes }
}

export function restoreJourney(persisted: PersistedJourney): Journey {
  const nodes: Record<string, JourneyNode> = {}
  for (const [id, node] of Object.entries(persisted.nodes)) {
    nodes[id] = { ...node, value: node.value ?? null }
  }
  return { ...persisted, nodes }
}

function readSaves(): Record<string, PersistedJourney> {
  try {
    const parsed: unknown = JSON.parse(readLocalStorage(SAVES_KEY) ?? "{}")
    return parsed !== null && typeof parsed === "object"
      ? (parsed as Record<string, PersistedJourney>)
      : {}
  } catch {
    return {}
  }
}

export function listSavedJourneys(): string[] {
  return Object.keys(readSaves()).sort()
}

export function saveJourney(journey: Journey): boolean {
  const saves = readSaves()
  saves[journey.name] = persistJourney(journey)
  return writeLocalStorage(SAVES_KEY, JSON.stringify(saves))
}

export function loadJourney(name: string): Journey | null {
  const persisted = readSaves()[name]
  if (!persisted) return null
  const journey = restoreJourney(persisted)
  // 存储可能被外部改坏:结构不自洽的旅程会让 getPath / 分支树陷入异常状态。
  return persisted.version === 1 && isStructurallyValid(journey) ? journey : null
}

export function deleteJourney(name: string): boolean {
  const saves = readSaves()
  if (!(name in saves)) return false
  delete saves[name]
  return writeLocalStorage(SAVES_KEY, JSON.stringify(saves))
}

export function saveDraft(journey: Journey): boolean {
  return writeLocalStorage(DRAFT_KEY, JSON.stringify(persistJourney(journey)))
}

export function deleteDraft(): boolean {
  return removeLocalStorage(DRAFT_KEY)
}

export function loadDraft(): Journey | null {
  try {
    const raw = readLocalStorage(DRAFT_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (parsed === null || typeof parsed !== "object") return null
    const candidate = parsed as PersistedJourney
    if (candidate.version !== 1 || !candidate.nodes?.[candidate.rootId]) return null
    const journey = restoreJourney(candidate)
    return isStructurallyValid(journey) ? journey : null
  } catch {
    return null
  }
}
