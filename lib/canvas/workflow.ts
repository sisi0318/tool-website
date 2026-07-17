import type { NodeInstance, Edge } from "./types"

const WORKFLOW_LIST_KEY = "canvas-workflow-list"

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

  const nodes: NodeInstance[] = value.nodes.flatMap((node) => {
    if (!isRecord(node) || typeof node.id !== "string" || typeof node.type !== "string") return []
    if (!isRecord(node.position) || typeof node.position.x !== "number" || typeof node.position.y !== "number") return []
    return [{
      id: node.id,
      type: node.type,
      position: { x: node.position.x, y: node.position.y },
      config: isRecord(node.config) ? node.config : {},
      ...(node.disabled === true ? { disabled: true } : {}),
    }]
  })
  const nodeIds = new Set(nodes.map((node) => node.id))
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
    workflow: data,
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
    const list: unknown = JSON.parse(localStorage.getItem(WORKFLOW_LIST_KEY) ?? "[]")
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
export function saveWorkflow(name: string, data: WorkflowData): boolean {
  const list = getWorkflowList()
  const exists = list.includes(name)

  // 保存 workflow 数据
  localStorage.setItem(getWorkflowKey(name), JSON.stringify(data))

  // 更新列表（如果是新名字）
  if (!exists) {
    list.push(name)
    localStorage.setItem(WORKFLOW_LIST_KEY, JSON.stringify(list))
  }

  return exists
}

/**
 * 从 localStorage 加载 workflow
 */
export function loadWorkflow(name: string): WorkflowData | null {
  if (typeof window === "undefined") return null
  const data = localStorage.getItem(getWorkflowKey(name))
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
  localStorage.setItem(WORKFLOW_LIST_KEY, JSON.stringify(newList))
  localStorage.removeItem(getWorkflowKey(name))
}

/**
 * 检查 workflow 名字是否存在
 */
export function workflowExists(name: string): boolean {
  return getWorkflowList().includes(name)
}
