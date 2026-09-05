import type { NodeInstance, Edge } from "./types"
import { readLocalStorage, removeLocalStorage, writeLocalStorage } from "../safe-storage"
import { stripUnpersistableNodes } from "./persist"

const WORKFLOW_LIST_KEY = "canvas-workflow-list"

/**
 * 持久化数据的结构版本:canvas-state、WORKFLOW_<name> 与导出文件共用。
 * 节点 / 边的持久化形态一旦改动就递增,并在 decodeWorkflowData 里补上迁移。
 */
export const CANVAS_SCHEMA_VERSION = 1

export type SaveWorkflowResult = "created" | "overwritten" | "failed"

export interface WorkflowData {
  nodes: NodeInstance[]
  edges: Edge[]
}

export interface PortableWorkflow {
  kind: "tool-website-workflow"
  version: number
  name: string
  exportedAt: string
  workflow: WorkflowData
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

export function normalizeWorkflowData(value: unknown): WorkflowData | null {
  if (!isRecord(value) || !Array.isArray(value.nodes) || !Array.isArray(value.edges)) return null

  // 重复 id 会让 React key 冲突、nodes.find 永远命中第一个、removeEdge 一次删两条。
  const seenNodeIds = new Set<string>()
  const nodes: NodeInstance[] = value.nodes.flatMap((node) => {
    if (!isRecord(node) || typeof node.id !== "string" || typeof node.type !== "string") return []
    if (!isRecord(node.position) || typeof node.position.x !== "number" || typeof node.position.y !== "number") return []
    if (seenNodeIds.has(node.id)) return []
    seenNodeIds.add(node.id)
    return [{
      id: node.id,
      type: node.type,
      position: { x: node.position.x, y: node.position.y },
      config: isRecord(node.config) ? node.config : {},
      ...(node.disabled === true ? { disabled: true } : {}),
    }]
  })
  const nodeIds = new Set(nodes.map((node) => node.id))
  const seenEdgeIds = new Set<string>()
  const occupiedTargets = new Set<string>()
  const edges: Edge[] = value.edges.flatMap((edge) => {
    if (
      !isRecord(edge)
      || typeof edge.id !== "string"
      || typeof edge.source !== "string"
      || typeof edge.target !== "string"
      || !nodeIds.has(edge.source)
      || !nodeIds.has(edge.target)
      || typeof edge.sourcePort !== "string"
      || typeof edge.targetPort !== "string"
    ) return []
    if (seenEdgeIds.has(edge.id)) return []
    // 一个输入端口只能接一条边,交互式连线本来就是这个约束。
    const targetKey = `${edge.target}:${edge.targetPort}`
    if (occupiedTargets.has(targetKey)) return []
    seenEdgeIds.add(edge.id)
    occupiedTargets.add(targetKey)
    return [{
      id: edge.id,
      source: edge.source,
      sourcePort: edge.sourcePort,
      target: edge.target,
      targetPort: edge.targetPort,
    }]
  })

  return { nodes, edges }
}

/** 落盘形态:带版本号;配置里剥掉 File/Blob 这类序列化后会变成坏值的东西 */
export function encodeWorkflowData(data: WorkflowData): string {
  return JSON.stringify({
    version: CANVAS_SCHEMA_VERSION,
    nodes: stripUnpersistableNodes(data.nodes),
    edges: data.edges,
  })
}

/**
 * 读盘入口:先按版本号迁移到当前形态,再做结构校验。
 * 没有版本号的是加版本号之前写的数据,按 v1 处理;比当前代码还新的版本读不懂,
 * 返回 null(画布保持为空),不把它当成损坏数据。
 */
export function decodeWorkflowData(raw: unknown): WorkflowData | null {
  if (!isRecord(raw)) return null
  const version = typeof raw.version === "number" ? raw.version : 1
  if (version > CANVAS_SCHEMA_VERSION) {
    console.warn(`Canvas data schema v${version} is newer than the supported v${CANVAS_SCHEMA_VERSION}`)
    return null
  }
  // 目前只有 v1。以后的迁移在这里按 version 逐级升到 CANVAS_SCHEMA_VERSION 再交给 normalize。
  return normalizeWorkflowData(raw)
}

export function serializeWorkflow(name: string, data: WorkflowData): string {
  const portable: PortableWorkflow = {
    kind: "tool-website-workflow",
    version: CANVAS_SCHEMA_VERSION,
    name: name.trim() || "workflow",
    exportedAt: new Date().toISOString(),
    workflow: { nodes: stripUnpersistableNodes(data.nodes), edges: data.edges },
  }
  return JSON.stringify(portable, null, 2)
}

export function parseWorkflowFile(contents: string): { name: string; data: WorkflowData } {
  let parsed: unknown
  try {
    parsed = JSON.parse(contents)
  } catch {
    throw new Error("INVALID_JSON")
  }

  if (isRecord(parsed) && parsed.kind === "tool-website-workflow") {
    const version = parsed.version
    if (!Number.isInteger(version) || (version as number) < 1 || (version as number) > CANVAS_SCHEMA_VERSION) {
      throw new Error("UNSUPPORTED_VERSION")
    }
    const data = isRecord(parsed.workflow) ? decodeWorkflowData({ ...parsed.workflow, version }) : null
    if (!data) throw new Error("INVALID_WORKFLOW")
    return { name: typeof parsed.name === "string" ? parsed.name : "workflow", data }
  }

  const legacyData = normalizeWorkflowData(parsed)
  if (!legacyData) throw new Error("INVALID_WORKFLOW")
  return { name: "workflow", data: legacyData }
}

/**
 * 获取所有保存的 workflow 名字列表
 */
export function getWorkflowList(): string[] {
  if (typeof window === "undefined") return []
  try {
    const list: unknown = JSON.parse(readLocalStorage(WORKFLOW_LIST_KEY) ?? "[]")
    return Array.isArray(list) ? list.filter((name): name is string => typeof name === "string") : []
  } catch {
    return []
  }
}

/**
 * 获取 workflow 的 localStorage key
 */
function getWorkflowKey(name: string): string {
  return `WORKFLOW_${name}`
}

/**
 * 保存 workflow 到 localStorage
 * @returns true 如果是覆盖已有 workflow
 */
/**
 * @returns "overwritten" 覆盖了同名工作流 / "created" 新建 / "failed" 写入失败
 */
export function saveWorkflow(name: string, data: WorkflowData): SaveWorkflowResult {
  const list = getWorkflowList()
  const exists = list.includes(name)

  // 数据写不进去就不能登记名字,否则列表里会留下一个加载不出内容的幽灵条目。
  if (!writeLocalStorage(getWorkflowKey(name), encodeWorkflowData(data))) {
    console.warn("Unable to persist workflow", name)
    return "failed"
  }

  if (!exists) {
    list.push(name)
    if (!writeLocalStorage(WORKFLOW_LIST_KEY, JSON.stringify(list))) {
      removeLocalStorage(getWorkflowKey(name))
      return "failed"
    }
  }

  return exists ? "overwritten" : "created"
}

/**
 * 从 localStorage 加载 workflow
 */
export function loadWorkflow(name: string): WorkflowData | null {
  const data = readLocalStorage(getWorkflowKey(name))
  if (!data) return null
  try {
    return decodeWorkflowData(JSON.parse(data))
  } catch {
    return null
  }
}

/**
 * 从 localStorage 删除 workflow
 */
export function deleteWorkflow(name: string): void {
  const list = getWorkflowList()
  const newList = list.filter((n) => n !== name)
  writeLocalStorage(WORKFLOW_LIST_KEY, JSON.stringify(newList))
  removeLocalStorage(getWorkflowKey(name))
}

/**
 * 检查 workflow 名字是否存在
 */
export function workflowExists(name: string): boolean {
  return getWorkflowList().includes(name)
}
