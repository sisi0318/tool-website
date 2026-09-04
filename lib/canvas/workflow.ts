import type { NodeInstance, Edge } from "./types"
import { readLocalStorage, removeLocalStorage, writeLocalStorage } from "../safe-storage"
import { stripUnpersistableNodes } from "./persist"

const WORKFLOW_LIST_KEY = "canvas-workflow-list"

export type SaveWorkflowResult = "created" | "overwritten" | "failed"

export interface WorkflowData {
  nodes: NodeInstance[]
  edges: Edge[]
}

export interface PortableWorkflow {
  kind: "tool-website-workflow"
  version: 1
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

export function serializeWorkflow(name: string, data: WorkflowData): string {
  const portable: PortableWorkflow = {
    kind: "tool-website-workflow",
    version: 1,
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
    if (parsed.version !== 1) throw new Error("UNSUPPORTED_VERSION")
    const data = normalizeWorkflowData(parsed.workflow)
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
  const payload: WorkflowData = { nodes: stripUnpersistableNodes(data.nodes), edges: data.edges }

  // 数据写不进去就不能登记名字,否则列表里会留下一个加载不出内容的幽灵条目。
  if (!writeLocalStorage(getWorkflowKey(name), JSON.stringify(payload))) {
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
    return normalizeWorkflowData(JSON.parse(data))
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
