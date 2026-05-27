import type { NodeInstance, Edge } from "./types"

const WORKFLOW_LIST_KEY = "canvas-workflow-list"

export interface WorkflowData {
  nodes: NodeInstance[]
  edges: Edge[]
}

/**
 * 获取所有保存的 workflow 名字列表
 */
export function getWorkflowList(): string[] {
  if (typeof window === "undefined") return []
  const list = localStorage.getItem(WORKFLOW_LIST_KEY)
  return list ? JSON.parse(list) : []
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
    return JSON.parse(data)
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
