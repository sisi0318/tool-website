import { create } from "zustand"
import type { NodeInstance, Edge } from "./types"
import { getNodeDefinition } from "./registry"
import { topologicalSort } from "./engine"

const nodeExecVersion = new Map<string, number>()
let saveTimer: ReturnType<typeof setTimeout> | null = null
const SAVE_DEBOUNCE_MS = 300
const MAX_HISTORY = 50

function debouncedSave(saveFn: () => void) {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(saveFn, SAVE_DEBOUNCE_MS)
}

interface Snapshot {
  nodes: NodeInstance[]
  edges: Edge[]
}

interface CanvasState {
  nodes: NodeInstance[]
  edges: Edge[]
  nodeOutputs: Record<string, Record<string, unknown>>
  nodeErrors: Record<string, string | undefined>
  nodeRunning: Record<string, boolean>
  selectedNodeId: string | null

  addNode: (node: NodeInstance) => void
  removeNode: (nodeId: string) => void
  updateNodePosition: (nodeId: string, position: { x: number; y: number }) => void
  updateNodeConfig: (nodeId: string, config: Record<string, unknown>) => void

  addEdge: (edge: Edge) => void
  removeEdge: (edgeId: string) => void

  selectNode: (nodeId: string | null) => void

  executeNode: (nodeId: string, visited?: Set<string>) => Promise<void>
  executeAll: () => Promise<void>

  pushHistory: () => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean

  saveToLocalStorage: () => void
  loadFromLocalStorage: () => void
  clearCanvas: () => void
}

const undoStack: Snapshot[] = []
const redoStack: Snapshot[] = []

export const useCanvasStore = create<CanvasState>((set, get) => ({
  nodes: [],
  edges: [],
  nodeOutputs: {},
  nodeErrors: {},
  nodeRunning: {},
  selectedNodeId: null,
  canUndo: false,
  canRedo: false,

  pushHistory: () => {
    const { nodes, edges } = get()
    undoStack.push({ nodes: structuredClone(nodes), edges: structuredClone(edges) })
    if (undoStack.length > MAX_HISTORY) undoStack.shift()
    redoStack.length = 0
    set({ canUndo: true, canRedo: false })
  },

  undo: () => {
    if (undoStack.length === 0) return
    const { nodes, edges } = get()
    redoStack.push({ nodes: structuredClone(nodes), edges: structuredClone(edges) })
    const snapshot = undoStack.pop()!
    set({
      nodes: snapshot.nodes,
      edges: snapshot.edges,
      canUndo: undoStack.length > 0,
      canRedo: true,
    })
    debouncedSave(() => get().saveToLocalStorage())
  },

  redo: () => {
    if (redoStack.length === 0) return
    const { nodes, edges } = get()
    undoStack.push({ nodes: structuredClone(nodes), edges: structuredClone(edges) })
    const snapshot = redoStack.pop()!
    set({
      nodes: snapshot.nodes,
      edges: snapshot.edges,
      canUndo: true,
      canRedo: redoStack.length > 0,
    })
    debouncedSave(() => get().saveToLocalStorage())
  },

  addNode: (node) => {
    get().pushHistory()
    set((state) => {
      debouncedSave(() => get().saveToLocalStorage())
      return { nodes: [...state.nodes, node] }
    })
  },

  removeNode: (nodeId) => {
    get().pushHistory()
    const affectedTargets = get().edges
      .filter((e) => e.source === nodeId)
      .map((e) => e.target)
    set((state) => {
      nodeExecVersion.delete(nodeId)
      debouncedSave(() => get().saveToLocalStorage())
      const { [nodeId]: _o, ...restOutputs } = state.nodeOutputs
      const { [nodeId]: _e, ...restErrors } = state.nodeErrors
      const { [nodeId]: _r, ...restRunning } = state.nodeRunning
      return {
        nodes: state.nodes.filter((n) => n.id !== nodeId),
        edges: state.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
        nodeOutputs: restOutputs,
        nodeErrors: restErrors,
        nodeRunning: restRunning,
        selectedNodeId: state.selectedNodeId === nodeId ? null : state.selectedNodeId,
      }
    })
    for (const targetId of affectedTargets) {
      setTimeout(() => get().executeNode(targetId), 0)
    }
  },

  updateNodePosition: (nodeId, position) => {
    const nodes = get().nodes
    const idx = nodes.findIndex((n) => n.id === nodeId)
    if (idx === -1) return
    const node = nodes[idx]
    if (node.position.x === position.x && node.position.y === position.y) return
    nodes[idx] = { ...node, position }
    set({ nodes: [...nodes] })
    debouncedSave(() => get().saveToLocalStorage())
  },

  updateNodeConfig: (nodeId, config) => {
    const version = (nodeExecVersion.get(nodeId) ?? 0) + 1
    nodeExecVersion.set(nodeId, version)
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === nodeId ? { ...n, config } : n
      ),
    }))
    debouncedSave(() => get().saveToLocalStorage())
    setTimeout(() => {
      if (nodeExecVersion.get(nodeId) === version) {
        get().executeNode(nodeId)
      }
    }, 0)
  },

  addEdge: (edge) => {
    get().pushHistory()
    set((state) => {
      debouncedSave(() => get().saveToLocalStorage())
      return { edges: [...state.edges, edge] }
    })
    setTimeout(() => get().executeNode(edge.target), 0)
  },

  removeEdge: (edgeId) => {
    get().pushHistory()
    const removedEdge = get().edges.find((e) => e.id === edgeId)
    set((state) => {
      debouncedSave(() => get().saveToLocalStorage())
      return { edges: state.edges.filter((e) => e.id !== edgeId) }
    })
    if (removedEdge) {
      setTimeout(() => get().executeNode(removedEdge.target), 0)
    }
  },

  selectNode: (nodeId) =>
    set({ selectedNodeId: nodeId }),

  executeNode: async (nodeId, visited) => {
    const v = visited ?? new Set<string>()
    if (v.has(nodeId)) return
    v.add(nodeId)

    const version = nodeExecVersion.get(nodeId) ?? 0

    const state = get()
    const node = state.nodes.find((n) => n.id === nodeId)
    if (!node) return

    const definition = getNodeDefinition(node.type)
    if (!definition) return

    const incomingEdges = state.edges.filter((e) => e.target === nodeId)
    const inputs: Record<string, unknown> = {}

    for (const edge of incomingEdges) {
      const sourceOutput = state.nodeOutputs[edge.source]
      if (sourceOutput && edge.sourcePort in sourceOutput) {
        inputs[edge.targetPort] = sourceOutput[edge.sourcePort]
      }
    }

    set((s) => ({
      nodeRunning: { ...s.nodeRunning, [nodeId]: true },
      nodeErrors: { ...s.nodeErrors, [nodeId]: undefined },
    }))

    try {
      const outputs = await definition.execute(inputs, node.config)

      if ((nodeExecVersion.get(nodeId) ?? 0) !== version) return

      set((s) => ({
        nodeOutputs: { ...s.nodeOutputs, [nodeId]: outputs },
        nodeRunning: { ...s.nodeRunning, [nodeId]: false },
      }))

      const downstreamEdges = get().edges.filter((e) => e.source === nodeId)
      for (const edge of downstreamEdges) {
        await get().executeNode(edge.target, v)
      }
    } catch (error) {
      if ((nodeExecVersion.get(nodeId) ?? 0) !== version) return

      set((s) => ({
        nodeErrors: {
          ...s.nodeErrors,
          [nodeId]: error instanceof Error ? error.message : String(error),
        },
        nodeRunning: { ...s.nodeRunning, [nodeId]: false },
      }))
    }
  },

  executeAll: async () => {
    const state = get()
    const { sorted, hasCycle } = topologicalSort(state.nodes, state.edges)
    if (hasCycle) {
      console.warn("Canvas contains cycles — skipped cyclic nodes")
    }
    const visited = new Set<string>()
    for (const node of sorted) {
      await get().executeNode(node.id, visited)
    }
  },

  saveToLocalStorage: () => {
    const state = get()
    localStorage.setItem(
      "canvas-state",
      JSON.stringify({ nodes: state.nodes, edges: state.edges })
    )
  },

  loadFromLocalStorage: () => {
    const saved = localStorage.getItem("canvas-state")
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (!parsed || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) return
        const nodes = parsed.nodes.filter(
          (n: any) => n && typeof n.id === "string" && typeof n.type === "string" && n.position
        )
        const nodeIds = new Set(nodes.map((n: NodeInstance) => n.id))
        const edges = parsed.edges.filter(
          (e: any) =>
            e &&
            typeof e.id === "string" &&
            nodeIds.has(e.source) &&
            nodeIds.has(e.target) &&
            typeof e.sourcePort === "string" &&
            typeof e.targetPort === "string"
        )
        set({ nodes, edges })
        setTimeout(() => get().executeAll(), 0)
      } catch {}
    }
  },

  clearCanvas: () => {
    set({
      nodes: [],
      edges: [],
      nodeOutputs: {},
      nodeErrors: {},
      nodeRunning: {},
      selectedNodeId: null,
    })
    debouncedSave(() => get().saveToLocalStorage())
  },
}))
