import type { Edge, NodeInstance } from "./types"

export interface AutoLayoutNodeSize {
  width: number
  height: number
}

export interface AutoLayoutOptions {
  /** Top-left coordinate of the generated layout. */
  origin?: Partial<NodeInstance["position"]>
  /** Estimated width used when a measured size is unavailable. */
  nodeWidth?: number
  /** Estimated height used when a measured size is unavailable. */
  nodeHeight?: number
  /** Empty space between adjacent dependency layers. */
  horizontalGap?: number
  /** Empty space between nodes in the same layer. */
  verticalGap?: number
  /** Optional measured/estimated size override for individual nodes. */
  getNodeSize?: (
    node: NodeInstance
  ) => Partial<AutoLayoutNodeSize> | undefined
}

export const DEFAULT_AUTO_LAYOUT_OPTIONS = {
  originX: 40,
  originY: 40,
  nodeWidth: 340,
  nodeHeight: 240,
  horizontalGap: 100,
  verticalGap: 60,
} as const

function positiveOrDefault(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : fallback
}

function nonNegativeOrDefault(
  value: number | undefined,
  fallback: number
): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : fallback
}

function finiteOrDefault(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

/**
 * Assigns a dependency layer to every node.
 *
 * Strongly connected nodes share a layer. The resulting component graph is a
 * DAG, so longest-path layering can still position dependencies around cycles
 * without omitting any nodes.
 */
export function calculateNodeLayers(
  nodes: readonly NodeInstance[],
  edges: readonly Edge[]
): Map<string, number> {
  if (nodes.length === 0) return new Map()

  const nodeIds = new Set(nodes.map((node) => node.id))
  const nodeOrder = new Map(nodes.map((node, index) => [node.id, index]))
  const adjacency = new Map<string, string[]>()

  for (const node of nodes) adjacency.set(node.id, [])
  for (const edge of edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue
    adjacency.get(edge.source)!.push(edge.target)
  }

  // Tarjan's algorithm. Iteration follows input node/edge order so the result
  // remains deterministic even when several valid arrangements exist.
  let nextIndex = 0
  const indices = new Map<string, number>()
  const lowLinks = new Map<string, number>()
  const stack: string[] = []
  const onStack = new Set<string>()
  const components: string[][] = []

  const visit = (nodeId: string) => {
    indices.set(nodeId, nextIndex)
    lowLinks.set(nodeId, nextIndex)
    nextIndex += 1
    stack.push(nodeId)
    onStack.add(nodeId)

    for (const targetId of adjacency.get(nodeId) ?? []) {
      if (!indices.has(targetId)) {
        visit(targetId)
        lowLinks.set(
          nodeId,
          Math.min(lowLinks.get(nodeId)!, lowLinks.get(targetId)!)
        )
      } else if (onStack.has(targetId)) {
        lowLinks.set(
          nodeId,
          Math.min(lowLinks.get(nodeId)!, indices.get(targetId)!)
        )
      }
    }

    if (lowLinks.get(nodeId) !== indices.get(nodeId)) return

    const component: string[] = []
    while (stack.length > 0) {
      const memberId = stack.pop()!
      onStack.delete(memberId)
      component.push(memberId)
      if (memberId === nodeId) break
    }
    component.sort((a, b) => nodeOrder.get(a)! - nodeOrder.get(b)!)
    components.push(component)
  }

  for (const node of nodes) {
    if (!indices.has(node.id)) visit(node.id)
  }

  const componentByNode = new Map<string, number>()
  const componentOrder: number[] = []
  components.forEach((component, componentIndex) => {
    componentOrder[componentIndex] = Math.min(
      ...component.map((nodeId) => nodeOrder.get(nodeId)!)
    )
    for (const nodeId of component) {
      componentByNode.set(nodeId, componentIndex)
    }
  })

  const componentAdjacency = components.map(() => new Set<number>())
  const inDegree = components.map(() => 0)
  for (const edge of edges) {
    const sourceComponent = componentByNode.get(edge.source)
    const targetComponent = componentByNode.get(edge.target)
    if (
      sourceComponent === undefined ||
      targetComponent === undefined ||
      sourceComponent === targetComponent ||
      componentAdjacency[sourceComponent].has(targetComponent)
    ) {
      continue
    }

    componentAdjacency[sourceComponent].add(targetComponent)
    inDegree[targetComponent] += 1
  }

  const compareComponents = (a: number, b: number) =>
    componentOrder[a] - componentOrder[b]
  const queue = components
    .map((_, componentIndex) => componentIndex)
    .filter((componentIndex) => inDegree[componentIndex] === 0)
    .sort(compareComponents)
  const componentLayers = components.map(() => 0)

  while (queue.length > 0) {
    const componentIndex = queue.shift()!
    const targets = [...componentAdjacency[componentIndex]].sort(compareComponents)

    for (const targetComponent of targets) {
      componentLayers[targetComponent] = Math.max(
        componentLayers[targetComponent],
        componentLayers[componentIndex] + 1
      )
      inDegree[targetComponent] -= 1
      if (inDegree[targetComponent] === 0) {
        queue.push(targetComponent)
        queue.sort(compareComponents)
      }
    }
  }

  const layers = new Map<string, number>()
  for (const node of nodes) {
    layers.set(node.id, componentLayers[componentByNode.get(node.id)!])
  }
  return layers
}

/**
 * Produces a stable left-to-right layered layout without mutating the inputs.
 * Nodes in the same layer retain their original array order.
 */
export function autoLayoutNodes(
  nodes: readonly NodeInstance[],
  edges: readonly Edge[],
  options: AutoLayoutOptions = {}
): NodeInstance[] {
  if (nodes.length === 0) return []

  const originX = finiteOrDefault(
    options.origin?.x,
    DEFAULT_AUTO_LAYOUT_OPTIONS.originX
  )
  const originY = finiteOrDefault(
    options.origin?.y,
    DEFAULT_AUTO_LAYOUT_OPTIONS.originY
  )
  const defaultWidth = positiveOrDefault(
    options.nodeWidth,
    DEFAULT_AUTO_LAYOUT_OPTIONS.nodeWidth
  )
  const defaultHeight = positiveOrDefault(
    options.nodeHeight,
    DEFAULT_AUTO_LAYOUT_OPTIONS.nodeHeight
  )
  const horizontalGap = nonNegativeOrDefault(
    options.horizontalGap,
    DEFAULT_AUTO_LAYOUT_OPTIONS.horizontalGap
  )
  const verticalGap = nonNegativeOrDefault(
    options.verticalGap,
    DEFAULT_AUTO_LAYOUT_OPTIONS.verticalGap
  )

  const sizes = new Map<string, AutoLayoutNodeSize>()
  for (const node of nodes) {
    const customSize = options.getNodeSize?.(node)
    sizes.set(node.id, {
      width: positiveOrDefault(customSize?.width, defaultWidth),
      height: positiveOrDefault(customSize?.height, defaultHeight),
    })
  }

  const layerByNode = calculateNodeLayers(nodes, edges)
  const nodesByLayer = new Map<number, NodeInstance[]>()
  for (const node of nodes) {
    const layer = layerByNode.get(node.id) ?? 0
    const layerNodes = nodesByLayer.get(layer)
    if (layerNodes) {
      layerNodes.push(node)
    } else {
      nodesByLayer.set(layer, [node])
    }
  }

  const layerNumbers = [...nodesByLayer.keys()].sort((a, b) => a - b)
  const xByLayer = new Map<number, number>()
  let nextX = originX
  for (const layer of layerNumbers) {
    xByLayer.set(layer, nextX)
    const widestNode = Math.max(
      ...nodesByLayer.get(layer)!.map((node) => sizes.get(node.id)!.width)
    )
    nextX += widestNode + horizontalGap
  }

  const positionByNode = new Map<string, NodeInstance["position"]>()
  for (const layer of layerNumbers) {
    let nextY = originY
    for (const node of nodesByLayer.get(layer)!) {
      positionByNode.set(node.id, { x: xByLayer.get(layer)!, y: nextY })
      nextY += sizes.get(node.id)!.height + verticalGap
    }
  }

  return nodes.map((node) => ({
    ...node,
    position: positionByNode.get(node.id)!,
  }))
}
