import type { ConfigField, Edge, ValidationResult } from "./types"

const COMPATIBLE_TYPES: Record<ConfigField["dataType"], readonly ConfigField["dataType"][]> = {
  string: ["string", "number", "json", "boolean"],
  number: ["string", "number"],
  json: ["json", "string"],
  bytes: ["bytes"],
  boolean: ["boolean", "string"],
}

export type ConnectionValidationCode =
  | "incompatible-types"
  | "self-connection"
  | "duplicate-connection"
  | "target-port-occupied"
  | "cycle"

export interface ConnectionValidationResult extends ValidationResult {
  code?: ConnectionValidationCode
  conflictingEdgeId?: string
}

/** A prospective edge which has not been assigned a persistent id yet. */
export type ConnectionCandidate = Omit<Edge, "id">

export interface ConnectionValidationContext {
  existingEdges: readonly Edge[]
  connection: ConnectionCandidate
}

function invalidConnection(
  code: ConnectionValidationCode,
  message: string,
  conflictingEdgeId?: string
): ConnectionValidationResult {
  return {
    valid: false,
    level: "error",
    code,
    message,
    ...(conflictingEdgeId ? { conflictingEdgeId } : {}),
  }
}

/**
 * Returns true when adding source -> target would introduce a directed cycle.
 *
 * Only graph reachability matters here, so port ids and dangling graph nodes do
 * not need to be supplied separately.
 */
export function wouldCreateCycle(
  existingEdges: readonly Edge[],
  sourceNodeId: string,
  targetNodeId: string
): boolean {
  if (sourceNodeId === targetNodeId) return true

  const adjacency = new Map<string, string[]>()
  for (const edge of existingEdges) {
    const targets = adjacency.get(edge.source)
    if (targets) {
      targets.push(edge.target)
    } else {
      adjacency.set(edge.source, [edge.target])
    }
  }

  // Adding source -> target creates a cycle exactly when target can already
  // reach source through the directed graph.
  const pending = [targetNodeId]
  const visited = new Set<string>()

  while (pending.length > 0) {
    const nodeId = pending.pop()!
    if (nodeId === sourceNodeId) return true
    if (visited.has(nodeId)) continue

    visited.add(nodeId)
    for (const nextNodeId of adjacency.get(nodeId) ?? []) {
      if (!visited.has(nextNodeId)) pending.push(nextNodeId)
    }
  }

  return false
}

/**
 * Validates edge-level constraints independently from port data types.
 * This is useful while previewing a drag, before field definitions are loaded.
 */
export function validateConnectionStructure(
  existingEdges: readonly Edge[],
  connection: ConnectionCandidate
): ConnectionValidationResult {
  if (connection.source === connection.target) {
    return invalidConnection("self-connection", "节点不能连接到自身。")
  }

  const duplicate = existingEdges.find(
    (edge) =>
      edge.source === connection.source &&
      edge.sourcePort === connection.sourcePort &&
      edge.target === connection.target &&
      edge.targetPort === connection.targetPort
  )
  if (duplicate) {
    return invalidConnection(
      "duplicate-connection",
      "该连接已存在。",
      duplicate.id
    )
  }

  const occupyingEdge = existingEdges.find(
    (edge) =>
      edge.target === connection.target &&
      edge.targetPort === connection.targetPort
  )

  const edgesAfterReplacement = occupyingEdge
    ? existingEdges.filter((edge) => edge.id !== occupyingEdge.id)
    : existingEdges
  if (wouldCreateCycle(edgesAfterReplacement, connection.source, connection.target)) {
    return invalidConnection("cycle", "该连接会形成循环依赖。")
  }

  if (occupyingEdge) {
    return invalidConnection(
      "target-port-occupied",
      "目标输入端口已被连接，请先删除原连接。",
      occupyingEdge.id
    )
  }

  return { valid: true, level: "ok" }
}

/**
 * Validates type compatibility and, when context is supplied, graph structure.
 * Existing two-argument callers retain their original type-only behaviour.
 */
export function validateConnection(
  source: ConfigField,
  target: ConfigField,
  context?: ConnectionValidationContext
): ConnectionValidationResult {
  const compatible = COMPATIBLE_TYPES[source.dataType].includes(target.dataType)
  if (!compatible) {
    return invalidConnection(
      "incompatible-types",
      `类型不兼容：${source.dataType} → ${target.dataType}。`
    )
  }

  if (context) {
    const structuralResult = validateConnectionStructure(
      context.existingEdges,
      context.connection
    )
    if (!structuralResult.valid) return structuralResult
  }

  return { valid: true, level: "ok" }
}

/**
 * Lightweight compatibility helper retained for existing callers.
 * For a user-facing reason, use validateConnectionStructure instead.
 */
export function canAcceptInput(
  existingEdges: readonly Edge[],
  _sourcePortId: string,
  targetNodeId: string,
  targetPortId: string
): boolean {
  return !existingEdges.some(
    (edge) => edge.target === targetNodeId && edge.targetPort === targetPortId
  )
}
