import type { Edge, NodeInstance } from "./types"
import { createCanvasNodeId } from "./node-factory"

export interface CanvasClipboardPayload {
  nodes: NodeInstance[]
  edges: Edge[]
}

export interface PasteOffset {
  x: number
  y: number
}

function cloneConfig(config: Record<string, unknown>): Record<string, unknown> {
  if (typeof structuredClone === "function") return structuredClone(config)
  return { ...config }
}

export function createClipboardPayload(
  nodes: readonly NodeInstance[],
  edges: readonly Edge[],
  selectedNodeIds: ReadonlySet<string>
): CanvasClipboardPayload {
  return {
    nodes: nodes
      .filter((node) => selectedNodeIds.has(node.id))
      .map((node) => ({ ...node, config: cloneConfig(node.config) })),
    edges: edges.filter(
      (edge) => selectedNodeIds.has(edge.source) && selectedNodeIds.has(edge.target)
    ),
  }
}

export function instantiateClipboardPayload(
  payload: CanvasClipboardPayload,
  offset: PasteOffset = { x: 40, y: 40 }
): CanvasClipboardPayload {
  const idMap = new Map<string, string>()
  const nodes = payload.nodes.map((node) => {
    const id = createCanvasNodeId()
    idMap.set(node.id, id)
    return {
      ...node,
      id,
      position: {
        x: node.position.x + offset.x,
        y: node.position.y + offset.y,
      },
      config: cloneConfig(node.config),
    }
  })

  const edges = payload.edges.flatMap((edge) => {
    const source = idMap.get(edge.source)
    const target = idMap.get(edge.target)
    if (!source || !target) return []

    return [{
      ...edge,
      id: `edge-${source}-${edge.sourcePort}-${target}-${edge.targetPort}`,
      source,
      target,
    }]
  })

  return { nodes, edges }
}
