import { create } from "zustand"
import type { NodeInstance, Edge } from "./types"
import { getNodeDefinition } from "./registry"
import { topologicalSort } from "./engine"

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

  executeNode: (nodeId: string) => Promise<void>
  executeAll: () => Promise<void>

  saveToLocalStorage: () => void
  loadFromLocalStorage: () => void
  clearCanvas: () => void
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  nodes: [],
  edges: [],
  nodeOutputs: {},
  nodeErrors: {},
  nodeRunning: {},
  selectedNodeId: null,

  addNode: (node) =>
    set((state) => {
      setTimeout(() => get().saveToLocalStorage(), 0)
      return { nodes: [...state.nodes, node] }
    }),

  removeNode: (nodeId) =>
    set((state) => {
      setTimeout(() => get().saveToLocalStorage(), 0)
      return {
        nodes: state.nodes.filter((n) => n.id !== nodeId),
        edges: state.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
        nodeOutputs: Object.fromEntries(
          Object.entries(state.nodeOutputs).filter(([k]) => k !== nodeId)
        ),
        nodeErrors: Object.fromEntries(
          Object.entries(state.nodeErrors).filter(([k]) => k !== nodeId)
        ),
        nodeRunning: Object.fromEntries(
          Object.entries(state.nodeRunning).filter(([k]) => k !== nodeId)
        ),
        selectedNodeId: state.selectedNodeId === nodeId ? null : state.selectedNodeId,
      }
    }),

  updateNodePosition: (nodeId, position) =>
    set((state) => {
      setTimeout(() => get().saveToLocalStorage(), 0)
      return {
        nodes: state.nodes.map((n) =>
          n.id === nodeId ? { ...n, position } : n
        ),
      }
    }),

  updateNodeConfig: (nodeId, config) => {
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === nodeId ? { ...n, config } : n
      ),
    }))
    setTimeout(() => get().saveToLocalStorage(), 0)
    // Auto-execute the node and downstream nodes
    setTimeout(() => get().executeNode(nodeId), 0)
  },

  addEdge: (edge) =>
    set((state) => {
      setTimeout(() => get().saveToLocalStorage(), 0)
      return { edges: [...state.edges, edge] }
    }),

  removeEdge: (edgeId) =>
    set((state) => {
      setTimeout(() => get().saveToLocalStorage(), 0)
      return { edges: state.edges.filter((e) => e.id !== edgeId) }
    }),

  selectNode: (nodeId) =>
    set({ selectedNodeId: nodeId }),

  executeNode: async (nodeId) => {
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
      set((s) => ({
        nodeOutputs: { ...s.nodeOutputs, [nodeId]: outputs },
        nodeRunning: { ...s.nodeRunning, [nodeId]: false },
      }))

      const downstreamEdges = state.edges.filter((e) => e.source === nodeId)
      for (const edge of downstreamEdges) {
        await get().executeNode(edge.target)
      }
    } catch (error) {
      set((s) => ({
        nodeErrors: { ...s.nodeErrors, [nodeId]: String(error) },
        nodeRunning: { ...s.nodeRunning, [nodeId]: false },
      }))
    }
  },

  executeAll: async () => {
    const state = get()
    const sorted = topologicalSort(state.nodes, state.edges)
    for (const node of sorted) {
      await get().executeNode(node.id)
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
        const { nodes, edges } = JSON.parse(saved)
        set({ nodes: nodes ?? [], edges: edges ?? [] })
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
    setTimeout(() => get().saveToLocalStorage(), 0)
  },
}))
