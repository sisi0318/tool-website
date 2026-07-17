import type { NodeInstance, Edge, NodeDefinition } from "./types"

export function topologicalSort(
  nodes: NodeInstance[],
  edges: Edge[]
): { sorted: NodeInstance[]; hasCycle: boolean } {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  const inDegree = new Map<string, number>()
  const adjacency = new Map<string, string[]>()

  for (const node of nodes) {
    inDegree.set(node.id, 0)
    adjacency.set(node.id, [])
  }

  for (const edge of edges) {
    if (nodeMap.has(edge.source) && nodeMap.has(edge.target)) {
      adjacency.get(edge.source)!.push(edge.target)
      inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1)
    }
  }

  const queue: string[] = []
  for (const [id, degree] of inDegree) {
    if (degree === 0) queue.push(id)
  }

  const sorted: NodeInstance[] = []
  while (queue.length > 0) {
    const id = queue.shift()!
    sorted.push(nodeMap.get(id)!)
    for (const neighbor of adjacency.get(id) ?? []) {
      const newDegree = (inDegree.get(neighbor) ?? 1) - 1
      inDegree.set(neighbor, newDegree)
      if (newDegree === 0) queue.push(neighbor)
    }
  }

  return { sorted, hasCycle: sorted.length < nodes.length }
}

export function propagateOutputs(
  nodes: NodeInstance[],
  edges: Edge[],
  nodeOutputs: Record<string, Record<string, unknown>>
): Record<string, Record<string, unknown>> {
  const result = { ...nodeOutputs }
  const { sorted } = topologicalSort(nodes, edges)

  for (const node of sorted) {
    const incomingEdges = edges.filter((e) => e.target === node.id)
    const inputs: Record<string, unknown> = {}

    for (const edge of incomingEdges) {
      if (result[edge.source] && edge.sourcePort in result[edge.source]) {
        inputs[edge.targetPort] = result[edge.source][edge.sourcePort]
      }
    }

    if (Object.keys(inputs).length > 0) {
      result[node.id] = { ...result[node.id], ...inputs }
    }
  }

  return result
}

/**
 * Produces graph-safe outputs for a disabled node. Config-backed output ports
 * retain their configured value, while derived outputs receive the first
 * upstream/config input of the same declared type. This provides an explicit
 * pass-through without pretending that the node implementation ran.
 */
export function createBypassOutputs(
  definition: NodeDefinition,
  inputs: Record<string, unknown>,
  config: Record<string, unknown>
): Record<string, unknown> {
  const hasOwn = (object: Record<string, unknown>, key: string) =>
    Object.prototype.hasOwnProperty.call(object, key)
  const inputValues = definition.config
    .filter((field) => field.hasInput)
    .flatMap((field) => {
      if (hasOwn(inputs, field.id)) {
        return [{ field, value: inputs[field.id] }]
      }
      if (hasOwn(config, field.id)) {
        return [{ field, value: config[field.id] }]
      }
      if (field.defaultValue !== undefined) {
        return [{ field, value: field.defaultValue }]
      }
      return []
    })
  const outputPorts = [
    ...definition.config.filter((field) => field.hasOutput),
    ...definition.outputs,
  ]

  return Object.fromEntries(outputPorts.flatMap((output) => {
    if (hasOwn(inputs, output.id)) return [[output.id, inputs[output.id]]]

    const configField = definition.config.find(
      (field) => field.id === output.id && field.hasOutput
    )
    if (configField) {
      if (hasOwn(config, output.id)) return [[output.id, config[output.id]]]
      if (configField.defaultValue !== undefined) {
        return [[output.id, configField.defaultValue]]
      }
    }

    const passthrough = inputValues.find(
      ({ field }) => field.dataType === output.dataType
    )
    return passthrough ? [[output.id, passthrough.value]] : []
  }))
}
