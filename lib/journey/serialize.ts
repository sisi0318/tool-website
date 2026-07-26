import { readLocalStorage, writeLocalStorage } from "../safe-storage"
import type { Journey, JourneyNode, JourneyStep, SharedJourneyPath } from "./types"

const SAVES_KEY = "journey-saves"
const DRAFT_KEY = "journey-draft"
const MAX_PERSISTED_VALUE_CHARS = 64 * 1024
const MAX_SHARED_ROOT_TEXT = 2 * 1024

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

export function encodeSharedPath(
  name: string,
  steps: JourneyStep[],
  rootText?: string,
): string {
  const payload: SharedJourneyPath = {
    v: 1,
    name,
    steps: steps.map((step) => ({ ...step, config: sanitizeConfig(step.config) })),
  }
  if (typeof rootText === "string" && rootText.length > 0 && rootText.length <= MAX_SHARED_ROOT_TEXT) {
    payload.rootText = rootText
  }
  return `j=${toBase64Url(JSON.stringify(payload))}`
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
  return persisted ? restoreJourney(persisted) : null
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

export function loadDraft(): Journey | null {
  try {
    const raw = readLocalStorage(DRAFT_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (parsed === null || typeof parsed !== "object") return null
    const candidate = parsed as PersistedJourney
    if (candidate.version !== 1 || !candidate.nodes?.[candidate.rootId]) return null
    return restoreJourney(candidate)
  } catch {
    return null
  }
}
