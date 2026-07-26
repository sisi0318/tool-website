import type { DataType } from "../canvas/types"
import type { Journey, JourneyNode, JourneyStep } from "./types"
import { createClientId } from "../client-id"

export function inferDataType(value: unknown): DataType {
  if (typeof value === "number") return "number"
  if (typeof value === "boolean") return "boolean"
  if (typeof Blob !== "undefined" && value instanceof Blob) return "bytes"
  if (value !== null && typeof value === "object") return "json"
  return "string"
}

export function createJourney(name: string, rootValue: unknown, rootLabel: string): Journey {
  const rootId = createClientId()
  const root: JourneyNode = {
    id: rootId,
    parentId: null,
    via: null,
    value: rootValue,
    valueType: inferDataType(rootValue),
    label: rootLabel,
    createdAt: Date.now(),
  }
  return { version: 1, name, rootId, activeId: rootId, nodes: { [rootId]: root } }
}

/** 在 parent 下追加一个新状态,返回新旅程(不可变更新)与新节点 id */
export function appendNode(
  journey: Journey,
  parentId: string,
  via: JourneyStep,
  value: unknown,
  label: string,
): { journey: Journey; nodeId: string } {
  if (!journey.nodes[parentId]) throw new Error(`Unknown parent node: ${parentId}`)
  const nodeId = createClientId()
  const node: JourneyNode = {
    id: nodeId,
    parentId,
    via,
    value,
    valueType: inferDataType(value),
    label,
    createdAt: Date.now(),
  }
  return {
    journey: {
      ...journey,
      activeId: nodeId,
      nodes: { ...journey.nodes, [nodeId]: node },
    },
    nodeId,
  }
}

/** 根 → 指定节点 的节点链(含两端);未知节点返回空数组 */
export function getPath(journey: Journey, nodeId: string): JourneyNode[] {
  const path: JourneyNode[] = []
  let current = journey.nodes[nodeId]
  while (current) {
    path.unshift(current)
    if (current.parentId === null) break
    current = journey.nodes[current.parentId]
  }
  return path.length > 0 && path[0].id === journey.rootId ? path : []
}

/** 路径上的变换序列(根节点无 via,故长度 = 路径节点数 - 1) */
export function getPathSteps(journey: Journey, nodeId: string): JourneyStep[] {
  return getPath(journey, nodeId)
    .map((node) => node.via)
    .filter((via): via is JourneyStep => via !== null)
}

export function getChildren(journey: Journey, nodeId: string): JourneyNode[] {
  return Object.values(journey.nodes)
    .filter((node) => node.parentId === nodeId)
    .sort((a, b) => a.createdAt - b.createdAt)
}

/** 删除节点及其整棵子树;根不可删。active 落在被删子树时回退到被删节点的父节点 */
export function removeSubtree(journey: Journey, nodeId: string): Journey {
  const target = journey.nodes[nodeId]
  if (!target || target.parentId === null) return journey

  const doomed = new Set<string>()
  const pending = [nodeId]
  while (pending.length > 0) {
    const currentId = pending.pop()!
    if (doomed.has(currentId)) continue
    doomed.add(currentId)
    for (const node of Object.values(journey.nodes)) {
      if (node.parentId === currentId) pending.push(node.id)
    }
  }

  const nodes: Record<string, JourneyNode> = {}
  for (const [id, node] of Object.entries(journey.nodes)) {
    if (!doomed.has(id)) nodes[id] = node
  }

  const activeId = doomed.has(journey.activeId) ? target.parentId : journey.activeId
  return { ...journey, nodes, activeId }
}

/** 替换某节点的值并使其子树失效(配置修改后沿路径重跑前的清理) */
export function replaceNodeValue(journey: Journey, nodeId: string, value: unknown): Journey {
  const node = journey.nodes[nodeId]
  if (!node) return journey
  return {
    ...journey,
    nodes: {
      ...journey.nodes,
      [nodeId]: { ...node, value, valueType: inferDataType(value) },
    },
  }
}

export function countNodes(journey: Journey): number {
  return Object.keys(journey.nodes).length
}

/** 有多个子节点的节点 id 集(足迹条上的分叉标记) */
export function getBranchPoints(journey: Journey): Set<string> {
  const childCount = new Map<string, number>()
  for (const node of Object.values(journey.nodes)) {
    if (node.parentId !== null) {
      childCount.set(node.parentId, (childCount.get(node.parentId) ?? 0) + 1)
    }
  }
  return new Set([...childCount.entries()].filter(([, count]) => count > 1).map(([id]) => id))
}
