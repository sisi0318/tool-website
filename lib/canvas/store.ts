import { create } from "zustand"
import type {
  NodeInstance,
  Edge,
  ExecutionLogEntry,
  ExecutionLogStatus,
  ExecutionStepProgress,
} from "./types"
import { getNodeDefinition } from "./registry"
import { createBypassOutputs, topologicalSort } from "./engine"
import { validateConnectionStructure } from "./validation"
import { normalizeWorkflowData } from "./workflow"

const nodeExecVersion = new Map<string, number>()
const activeNodeRunTokens = new Map<string, number>()
let nextNodeRunToken = 0
let executionRevision = 0
let stepExecutionRevision = -1
let stepExecutionIndex = 0
const nodeExecTimers = new Map<string, ReturnType<typeof setTimeout>>()
let saveTimer: ReturnType<typeof setTimeout> | null = null
const SAVE_DEBOUNCE_MS = 300
const AUTO_EXEC_DEBOUNCE_MS = 350
const CONFIG_HISTORY_WINDOW_MS = 750
const MAX_HISTORY = 50
const MAX_EXECUTION_LOG_ENTRIES = 100

let configHistoryGroup: { nodeId: string; updatedAt: number } | null = null

function clearNodeExecutionTimer(nodeId: string) {
  const timer = nodeExecTimers.get(nodeId)
  if (timer) clearTimeout(timer)
  nodeExecTimers.delete(nodeId)
}

function clearAllNodeExecutionTimers() {
  for (const timer of nodeExecTimers.values()) clearTimeout(timer)
  nodeExecTimers.clear()
}

function resetConfigHistoryGroup() {
  configHistoryGroup = null
}

function invalidateExecutionPlan() {
  executionRevision += 1
  stepExecutionRevision = -1
  stepExecutionIndex = 0
}

function emptyStepProgress(): ExecutionStepProgress {
  return { current: 0, total: 0, nextNodeId: null }
}

function collectReachableNodeIds(
  startNodeId: string,
  edges: readonly Edge[],
  direction: "upstream" | "downstream"
): Set<string> {
  const result = new Set<string>()
  const pending = [startNodeId]

  while (pending.length > 0) {
    const nodeId = pending.pop()!
    if (result.has(nodeId)) continue
    result.add(nodeId)

    for (const edge of edges) {
      if (direction === "upstream" && edge.target === nodeId) {
        pending.push(edge.source)
      } else if (direction === "downstream" && edge.source === nodeId) {
        pending.push(edge.target)
      }
    }
  }

  return result
}

function isManualNode(node: NodeInstance | undefined): boolean {
  return Boolean(node && getNodeDefinition(node.type)?.executionMode === "manual")
}

function settleExecutionLog(
  entries: ExecutionLogEntry[],
  id: number,
  status: Exclude<ExecutionLogStatus, "running">,
  finishedAt: number,
  error?: string
): ExecutionLogEntry[] {
  return entries.map((entry) => {
    if (entry.id !== id || entry.status !== "running") return entry

    const settled: ExecutionLogEntry = {
      ...entry,
      status,
      durationMs: Math.max(0, finishedAt - entry.startedAt),
    }
    if (error !== undefined) settled.error = error
    return settled
  })
}

function cancelRunningExecutionLogs(
  entries: ExecutionLogEntry[],
  finishedAt: number,
  nodeId?: string
): ExecutionLogEntry[] {
  return entries.map((entry) => {
    if (
      entry.status !== "running" ||
      (nodeId !== undefined && entry.nodeId !== nodeId)
    ) {
      return entry
    }

    return {
      ...entry,
      status: "cancelled",
      durationMs: Math.max(0, finishedAt - entry.startedAt),
    }
  })
}

function debouncedSave(saveFn: () => void) {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(saveFn, SAVE_DEBOUNCE_MS)
}

interface Snapshot {
  nodes: NodeInstance[]
  edges: Edge[]
  preserveExecutionState?: boolean
}

interface CanvasState {
  nodes: NodeInstance[]
  edges: Edge[]
  nodeOutputs: Record<string, Record<string, unknown>>
  nodeErrors: Record<string, string | undefined>
  nodeRunning: Record<string, boolean>
  executionLog: ExecutionLogEntry[]
  selectedNodeId: string | null
  selectedNodeIds: string[]
  autoRun: boolean
  stepProgress: ExecutionStepProgress

  addNode: (node: NodeInstance) => void
  addSubgraph: (data: { nodes: NodeInstance[]; edges: Edge[] }) => void
  removeNode: (nodeId: string) => void
  removeNodes: (nodeIds: string[]) => void
  updateNodePosition: (nodeId: string, position: { x: number; y: number }) => void
  updateNodePositions: (
    updates: Array<{ id: string; position: { x: number; y: number } }>
  ) => void
  updateNodeConfig: (nodeId: string, config: Record<string, unknown>) => void
  setNodeDisabled: (nodeId: string, disabled: boolean) => void

  addEdge: (edge: Edge) => void
  removeEdge: (edgeId: string) => void

  selectNode: (nodeId: string | null) => void
  selectNodes: (nodeIds: string[]) => void

  executeNode: (
    nodeId: string,
    visited?: Set<string>,
    cascade?: boolean,
    includeManual?: boolean
  ) => Promise<void>
  executeAll: (includeManual?: boolean) => Promise<void>
  executeToNode: (nodeId: string, includeManual?: boolean) => Promise<void>
  executeStep: (includeManual?: boolean) => Promise<void>
  setAutoRun: (enabled: boolean) => void
  clearExecutionLog: () => void

  pushHistory: (options?: { preserveExecutionState?: boolean }) => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean

  saveToLocalStorage: () => void
  loadFromLocalStorage: () => void
  replaceWorkflow: (data: { nodes: NodeInstance[]; edges: Edge[] }) => void
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
  executionLog: [],
  selectedNodeId: null,
  selectedNodeIds: [],
  autoRun: true,
  stepProgress: emptyStepProgress(),
  canUndo: false,
  canRedo: false,

  pushHistory: (options) => {
    const { nodes, edges } = get()
    undoStack.push({
      nodes: structuredClone(nodes),
      edges: structuredClone(edges),
      preserveExecutionState: options?.preserveExecutionState,
    })
    if (undoStack.length > MAX_HISTORY) undoStack.shift()
    redoStack.length = 0
    set({ canUndo: true, canRedo: false })
  },

  undo: () => {
    if (undoStack.length === 0) return
    resetConfigHistoryGroup()
    const snapshot = undoStack.pop()!
    if (!snapshot.preserveExecutionState) {
      invalidateExecutionPlan()
      clearAllNodeExecutionTimers()
      nodeExecVersion.clear()
      activeNodeRunTokens.clear()
    }
    const { nodes, edges } = get()
    redoStack.push({
      nodes: structuredClone(nodes),
      edges: structuredClone(edges),
      preserveExecutionState: snapshot.preserveExecutionState,
    })
    set((state) => {
      const nodeIds = new Set(snapshot.nodes.map((node) => node.id))
      const selectedNodeIds = state.selectedNodeIds.filter((id) => nodeIds.has(id))
      return {
        nodes: snapshot.nodes,
        edges: snapshot.edges,
        ...(snapshot.preserveExecutionState
          ? {}
          : {
              nodeOutputs: {},
              nodeErrors: {},
              nodeRunning: {},
              executionLog: cancelRunningExecutionLogs(state.executionLog, Date.now()),
              stepProgress: emptyStepProgress(),
            }),
        selectedNodeIds,
        selectedNodeId: selectedNodeIds.length === 1 ? selectedNodeIds[0] : null,
        canUndo: undoStack.length > 0,
        canRedo: true,
      }
    })
    debouncedSave(() => get().saveToLocalStorage())
    if (!snapshot.preserveExecutionState && get().autoRun) {
      setTimeout(() => {
        if (get().autoRun) get().executeAll(false)
      }, 0)
    }
  },

  redo: () => {
    if (redoStack.length === 0) return
    resetConfigHistoryGroup()
    const snapshot = redoStack.pop()!
    if (!snapshot.preserveExecutionState) {
      invalidateExecutionPlan()
      clearAllNodeExecutionTimers()
      nodeExecVersion.clear()
      activeNodeRunTokens.clear()
    }
    const { nodes, edges } = get()
    undoStack.push({
      nodes: structuredClone(nodes),
      edges: structuredClone(edges),
      preserveExecutionState: snapshot.preserveExecutionState,
    })
    set((state) => {
      const nodeIds = new Set(snapshot.nodes.map((node) => node.id))
      const selectedNodeIds = state.selectedNodeIds.filter((id) => nodeIds.has(id))
      return {
        nodes: snapshot.nodes,
        edges: snapshot.edges,
        ...(snapshot.preserveExecutionState
          ? {}
          : {
              nodeOutputs: {},
              nodeErrors: {},
              nodeRunning: {},
              executionLog: cancelRunningExecutionLogs(state.executionLog, Date.now()),
              stepProgress: emptyStepProgress(),
            }),
        selectedNodeIds,
        selectedNodeId: selectedNodeIds.length === 1 ? selectedNodeIds[0] : null,
        canUndo: true,
        canRedo: redoStack.length > 0,
      }
    })
    debouncedSave(() => get().saveToLocalStorage())
    if (!snapshot.preserveExecutionState && get().autoRun) {
      setTimeout(() => {
        if (get().autoRun) get().executeAll(false)
      }, 0)
    }
  },

  addNode: (node) => {
    invalidateExecutionPlan()
    resetConfigHistoryGroup()
    get().pushHistory()
    set((state) => {
      debouncedSave(() => get().saveToLocalStorage())
      return {
        nodes: [...state.nodes, node],
        selectedNodeId: node.id,
        selectedNodeIds: [node.id],
        stepProgress: emptyStepProgress(),
      }
    })
  },

  addSubgraph: ({ nodes, edges }) => {
    if (nodes.length === 0) return

    const state = get()
    const existingNodeIds = new Set(state.nodes.map((node) => node.id))
    const addedNodeIds = new Set<string>()
    const addedNodes = nodes.filter((node) => {
      if (existingNodeIds.has(node.id) || addedNodeIds.has(node.id)) return false
      addedNodeIds.add(node.id)
      return true
    })
    if (addedNodes.length === 0) return

    const availableNodeIds = new Set([...existingNodeIds, ...addedNodeIds])
    let nextEdges = [...state.edges]
    const edgeIds = new Set(nextEdges.map((edge) => edge.id))
    for (const edge of edges) {
      if (edgeIds.has(edge.id)) continue
      if (!availableNodeIds.has(edge.source) || !availableNodeIds.has(edge.target)) continue

      const validation = validateConnectionStructure(nextEdges, edge)
      if (!validation.valid && validation.code !== "target-port-occupied") continue
      if (validation.code === "target-port-occupied") {
        if (validation.conflictingEdgeId) {
          edgeIds.delete(validation.conflictingEdgeId)
        }
        nextEdges = nextEdges.filter(
          (existing) => existing.id !== validation.conflictingEdgeId
        )
      }
      nextEdges.push(edge)
      edgeIds.add(edge.id)
    }

    invalidateExecutionPlan()
    resetConfigHistoryGroup()
    get().pushHistory()
    set({
      nodes: [...state.nodes, ...addedNodes],
      edges: nextEdges,
      selectedNodeId: addedNodes.at(-1)?.id ?? state.selectedNodeId,
      selectedNodeIds: [addedNodes.at(-1)!.id],
      stepProgress: emptyStepProgress(),
    })
    debouncedSave(() => get().saveToLocalStorage())
    if (get().autoRun) {
      setTimeout(() => {
        if (get().autoRun) get().executeAll(false)
      }, 0)
    }
  },

  removeNode: (nodeId) => {
    if (!get().nodes.some((node) => node.id === nodeId)) return
    invalidateExecutionPlan()
    resetConfigHistoryGroup()
    get().pushHistory()
    const affectedTargets = get().edges
      .filter((e) => e.source === nodeId)
      .map((e) => e.target)
    set((state) => {
      nodeExecVersion.delete(nodeId)
      activeNodeRunTokens.delete(nodeId)
      clearNodeExecutionTimer(nodeId)
      debouncedSave(() => get().saveToLocalStorage())
      const { [nodeId]: _o, ...restOutputs } = state.nodeOutputs
      const { [nodeId]: _e, ...restErrors } = state.nodeErrors
      const { [nodeId]: _r, ...restRunning } = state.nodeRunning
      const selectedNodeIds = state.selectedNodeIds.filter((id) => id !== nodeId)
      return {
        nodes: state.nodes.filter((n) => n.id !== nodeId),
        edges: state.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
        nodeOutputs: restOutputs,
        nodeErrors: restErrors,
        nodeRunning: restRunning,
        executionLog: cancelRunningExecutionLogs(
          state.executionLog,
          Date.now(),
          nodeId
        ),
        stepProgress: emptyStepProgress(),
        selectedNodeIds,
        selectedNodeId: selectedNodeIds.length === 1 ? selectedNodeIds[0] : null,
      }
    })
    if (get().autoRun) {
      for (const targetId of affectedTargets) {
        setTimeout(() => {
          if (get().autoRun) {
            get().executeNode(targetId, undefined, true, false)
          }
        }, 0)
      }
    }
  },

  removeNodes: (nodeIds) => {
    const requestedIds = new Set(nodeIds)
    const existingIds = new Set(
      get().nodes.filter((node) => requestedIds.has(node.id)).map((node) => node.id)
    )
    if (existingIds.size === 0) return

    invalidateExecutionPlan()
    resetConfigHistoryGroup()
    get().pushHistory()

    const affectedTargets = new Set(
      get().edges
        .filter((edge) => existingIds.has(edge.source) && !existingIds.has(edge.target))
        .map((edge) => edge.target)
    )

    for (const nodeId of existingIds) {
      nodeExecVersion.delete(nodeId)
      activeNodeRunTokens.delete(nodeId)
      clearNodeExecutionTimer(nodeId)
    }

    set((state) => {
      const nodeOutputs = { ...state.nodeOutputs }
      const nodeErrors = { ...state.nodeErrors }
      const nodeRunning = { ...state.nodeRunning }
      let executionLog = state.executionLog

      for (const nodeId of existingIds) {
        delete nodeOutputs[nodeId]
        delete nodeErrors[nodeId]
        delete nodeRunning[nodeId]
        executionLog = cancelRunningExecutionLogs(executionLog, Date.now(), nodeId)
      }
      const selectedNodeIds = state.selectedNodeIds.filter(
        (id) => !existingIds.has(id)
      )

      return {
        nodes: state.nodes.filter((node) => !existingIds.has(node.id)),
        edges: state.edges.filter(
          (edge) => !existingIds.has(edge.source) && !existingIds.has(edge.target)
        ),
        nodeOutputs,
        nodeErrors,
        nodeRunning,
        executionLog,
        selectedNodeIds,
        selectedNodeId: selectedNodeIds.length === 1 ? selectedNodeIds[0] : null,
        stepProgress: emptyStepProgress(),
      }
    })
    debouncedSave(() => get().saveToLocalStorage())

    if (get().autoRun) {
      for (const targetId of affectedTargets) {
        setTimeout(() => {
          if (get().autoRun) get().executeNode(targetId, undefined, true, false)
        }, 0)
      }
    }
  },

  updateNodePosition: (nodeId, position) => {
    const nodes = get().nodes
    const node = nodes.find((candidate) => candidate.id === nodeId)
    if (!node) return
    if (node.position.x === position.x && node.position.y === position.y) return
    resetConfigHistoryGroup()
    get().pushHistory({ preserveExecutionState: true })
    set({
      nodes: nodes.map((candidate) =>
        candidate.id === nodeId ? { ...candidate, position } : candidate
      ),
    })
    debouncedSave(() => get().saveToLocalStorage())
  },

  updateNodePositions: (updates) => {
    if (updates.length === 0) return
    const positions = new Map(updates.map((update) => [update.id, update.position]))
    const currentNodes = get().nodes
    const hasChanges = currentNodes.some((node) => {
      const position = positions.get(node.id)
      return position && (
        position.x !== node.position.x || position.y !== node.position.y
      )
    })
    if (!hasChanges) return

    resetConfigHistoryGroup()
    get().pushHistory({ preserveExecutionState: true })
    set({
      nodes: currentNodes.map((node) => {
        const position = positions.get(node.id)
        return position ? { ...node, position } : node
      }),
    })
    debouncedSave(() => get().saveToLocalStorage())
  },

  updateNodeConfig: (nodeId, config) => {
    const currentNode = get().nodes.find((node) => node.id === nodeId)
    if (!currentNode) return
    invalidateExecutionPlan()

    const now = Date.now()
    const startsNewHistoryGroup =
      !configHistoryGroup ||
      configHistoryGroup.nodeId !== nodeId ||
      now - configHistoryGroup.updatedAt > CONFIG_HISTORY_WINDOW_MS

    if (startsNewHistoryGroup) get().pushHistory()
    configHistoryGroup = { nodeId, updatedAt: now }

    const version = (nodeExecVersion.get(nodeId) ?? 0) + 1
    nodeExecVersion.set(nodeId, version)
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === nodeId ? { ...n, config } : n
      ),
      stepProgress: emptyStepProgress(),
    }))
    debouncedSave(() => get().saveToLocalStorage())

    clearNodeExecutionTimer(nodeId)
    if (!get().autoRun || isManualNode(currentNode)) return

    const timer = setTimeout(() => {
      nodeExecTimers.delete(nodeId)
      if (nodeExecVersion.get(nodeId) === version) {
        get().executeNode(nodeId, undefined, true, false)
      }
    }, AUTO_EXEC_DEBOUNCE_MS)
    nodeExecTimers.set(nodeId, timer)
  },

  setNodeDisabled: (nodeId, disabled) => {
    const state = get()
    const node = state.nodes.find((candidate) => candidate.id === nodeId)
    if (!node || Boolean(node.disabled) === disabled) return

    invalidateExecutionPlan()
    resetConfigHistoryGroup()
    get().pushHistory()

    const affectedNodeIds = collectReachableNodeIds(
      nodeId,
      state.edges,
      "downstream"
    )
    for (const affectedNodeId of affectedNodeIds) {
      clearNodeExecutionTimer(affectedNodeId)
    }

    set((current) => {
      const nodeOutputs = { ...current.nodeOutputs }
      const nodeErrors = { ...current.nodeErrors }
      const nodeRunning = { ...current.nodeRunning }
      let executionLog = current.executionLog

      for (const affectedNodeId of affectedNodeIds) {
        delete nodeOutputs[affectedNodeId]
        delete nodeErrors[affectedNodeId]
        delete nodeRunning[affectedNodeId]
        executionLog = cancelRunningExecutionLogs(
          executionLog,
          Date.now(),
          affectedNodeId
        )
      }

      return {
        nodes: current.nodes.map((candidate) =>
          candidate.id === nodeId
            ? { ...candidate, disabled }
            : candidate
        ),
        nodeOutputs,
        nodeErrors,
        nodeRunning,
        executionLog,
        stepProgress: emptyStepProgress(),
      }
    })
    debouncedSave(() => get().saveToLocalStorage())

    if (get().autoRun) {
      setTimeout(() => {
        if (get().autoRun) get().executeAll(false)
      }, 0)
    }
  },

  addEdge: (edge) => {
    if (get().edges.some((existing) => existing.id === edge.id)) return
    const validation = validateConnectionStructure(get().edges, edge)
    if (!validation.valid && validation.code !== "target-port-occupied") return
    invalidateExecutionPlan()

    const occupiedEdgeId = validation.code === "target-port-occupied"
      ? validation.conflictingEdgeId
      : undefined
    resetConfigHistoryGroup()
    get().pushHistory()
    set((state) => {
      debouncedSave(() => get().saveToLocalStorage())
      return {
        edges: [
          ...state.edges.filter((existing) => existing.id !== occupiedEdgeId),
          edge,
        ],
        stepProgress: emptyStepProgress(),
      }
    })
    if (get().autoRun) {
      setTimeout(() => {
        if (get().autoRun) {
          get().executeNode(edge.target, undefined, true, false)
        }
      }, 0)
    }
  },

  removeEdge: (edgeId) => {
    if (!get().edges.some((edge) => edge.id === edgeId)) return
    invalidateExecutionPlan()
    resetConfigHistoryGroup()
    get().pushHistory()
    const removedEdge = get().edges.find((e) => e.id === edgeId)
    set((state) => {
      debouncedSave(() => get().saveToLocalStorage())
      return {
        edges: state.edges.filter((e) => e.id !== edgeId),
        stepProgress: emptyStepProgress(),
      }
    })
    if (removedEdge && get().autoRun) {
      setTimeout(() => {
        if (get().autoRun) {
          get().executeNode(removedEdge.target, undefined, true, false)
        }
      }, 0)
    }
  },

  selectNode: (nodeId) => {
    const state = get()
    const selectedNodeIds = nodeId ? [nodeId] : []
    if (
      state.selectedNodeId !== nodeId ||
      state.selectedNodeIds.length !== selectedNodeIds.length ||
      state.selectedNodeIds[0] !== selectedNodeIds[0]
    ) {
      set({ selectedNodeId: nodeId, selectedNodeIds })
    }
  },

  selectNodes: (nodeIds) => {
    const existingIds = new Set(get().nodes.map((node) => node.id))
    const selectedNodeIds = [...new Set(nodeIds)].filter((id) => existingIds.has(id))
    const selectedNodeId = selectedNodeIds.length === 1 ? selectedNodeIds[0] : null
    const state = get()
    const unchanged =
      state.selectedNodeId === selectedNodeId &&
      state.selectedNodeIds.length === selectedNodeIds.length &&
      state.selectedNodeIds.every((id) => selectedNodeIds.includes(id))
    if (!unchanged) set({ selectedNodeId, selectedNodeIds })
  },

  executeNode: async (nodeId, _visited, cascade = true, includeManual = true) => {
    const planRevision = executionRevision
    const state = get()
    const node = state.nodes.find((n) => n.id === nodeId)
    if (!node) return

    const definition = getNodeDefinition(node.type)
    if (!definition) return
    if (!includeManual && definition.executionMode === "manual") return

    if (cascade) {
      const reachable = new Set<string>()
      const pending = [nodeId]

      while (pending.length > 0) {
        const currentId = pending.pop()!
        if (reachable.has(currentId)) continue

        const currentNode = state.nodes.find((candidate) => candidate.id === currentId)
        if (!currentNode || (!includeManual && isManualNode(currentNode))) continue

        reachable.add(currentId)
        for (const edge of state.edges) {
          if (edge.source === currentId) pending.push(edge.target)
        }
      }

      const reachableNodes = state.nodes.filter((candidate) => reachable.has(candidate.id))
      const reachableEdges = state.edges.filter(
        (edge) => reachable.has(edge.source) && reachable.has(edge.target)
      )
      const { sorted, hasCycle } = topologicalSort(reachableNodes, reachableEdges)

      if (hasCycle) {
        console.warn("Canvas contains cycles — skipped cyclic nodes")
      }

      for (const reachableNode of sorted) {
        if (executionRevision !== planRevision) return
        await get().executeNode(reachableNode.id, undefined, false, includeManual)
        if (executionRevision !== planRevision) return
      }
      return
    }

    const version = nodeExecVersion.get(nodeId) ?? 0
    const runToken = ++nextNodeRunToken
    const startedAt = Date.now()
    activeNodeRunTokens.set(nodeId, runToken)

    const incomingEdges = state.edges.filter((e) => e.target === nodeId)
    const inputs: Record<string, unknown> = {}

    for (const edge of incomingEdges) {
      const sourceOutput = state.nodeOutputs[edge.source]
      if (sourceOutput && edge.sourcePort in sourceOutput) {
        inputs[edge.targetPort] = sourceOutput[edge.sourcePort]
      }
    }

    set((s) => {
      const executionLog = cancelRunningExecutionLogs(
        s.executionLog,
        startedAt,
        nodeId
      )
      executionLog.push({
        id: runToken,
        nodeId,
        nodeType: node.type,
        status: "running",
        startedAt,
        durationMs: 0,
      })

      return {
        nodeRunning: { ...s.nodeRunning, [nodeId]: true },
        nodeErrors: { ...s.nodeErrors, [nodeId]: undefined },
        executionLog: executionLog.slice(-MAX_EXECUTION_LOG_ENTRIES),
      }
    })

    try {
      const outputs = node.disabled
        ? createBypassOutputs(definition, inputs, node.config)
        : {
            ...Object.fromEntries(
              definition.config
                .filter((field) => field.hasOutput)
                .map((field) => {
                  const hasInputValue = Object.prototype.hasOwnProperty.call(
                    inputs,
                    field.id
                  )
                  const value = hasInputValue
                    ? inputs[field.id]
                    : node.config[field.id] ?? field.defaultValue
                  return [field.id, value]
                })
            ),
            ...await definition.execute(inputs, node.config),
          }

      if (
        executionRevision !== planRevision ||
        (nodeExecVersion.get(nodeId) ?? 0) !== version ||
        activeNodeRunTokens.get(nodeId) !== runToken
      ) {
        set((s) => ({
          executionLog: settleExecutionLog(
            s.executionLog,
            runToken,
            "cancelled",
            Date.now()
          ),
        }))
        return
      }

      set((s) => ({
        nodeOutputs: { ...s.nodeOutputs, [nodeId]: outputs },
        executionLog: settleExecutionLog(
          s.executionLog,
          runToken,
          node.disabled ? "skipped" : "success",
          Date.now()
        ),
      }))

    } catch (error) {
      if (
        executionRevision !== planRevision ||
        (nodeExecVersion.get(nodeId) ?? 0) !== version ||
        activeNodeRunTokens.get(nodeId) !== runToken
      ) {
        set((s) => ({
          executionLog: settleExecutionLog(
            s.executionLog,
            runToken,
            "cancelled",
            Date.now()
          ),
        }))
        return
      }

      const message = error instanceof Error ? error.message : String(error)
      set((s) => {
        const { [nodeId]: _staleOutput, ...nodeOutputs } = s.nodeOutputs
        return {
          nodeOutputs,
          nodeErrors: {
            ...s.nodeErrors,
            [nodeId]: message,
          },
          executionLog: settleExecutionLog(
            s.executionLog,
            runToken,
            "error",
            Date.now(),
            message
          ),
        }
      })
    } finally {
      if (activeNodeRunTokens.get(nodeId) === runToken) {
        set((s) => ({
          nodeRunning: { ...s.nodeRunning, [nodeId]: false },
        }))
      }
    }
  },

  executeAll: async (includeManual = true) => {
    const planRevision = executionRevision
    const state = get()
    stepExecutionRevision = -1
    stepExecutionIndex = 0
    set({ stepProgress: emptyStepProgress() })
    const { sorted, hasCycle } = topologicalSort(state.nodes, state.edges)
    if (hasCycle) {
      console.warn("Canvas contains cycles — skipped cyclic nodes")
    }
    const skippedNodes = new Set<string>()
    for (const node of sorted) {
      if (executionRevision !== planRevision) return
      const dependsOnSkippedNode = state.edges.some(
        (edge) => edge.target === node.id && skippedNodes.has(edge.source)
      )
      if (!includeManual && (isManualNode(node) || dependsOnSkippedNode)) {
        skippedNodes.add(node.id)
        continue
      }
      // Execute in topological order without recursively running descendants.
      // This ensures converging branches have all upstream outputs available.
      await get().executeNode(node.id, undefined, false, includeManual)
      if (executionRevision !== planRevision) return
    }
  },

  executeToNode: async (nodeId, includeManual = true) => {
    const planRevision = executionRevision
    const state = get()
    if (!state.nodes.some((node) => node.id === nodeId)) return

    stepExecutionRevision = -1
    stepExecutionIndex = 0
    set({ stepProgress: emptyStepProgress() })

    const requiredNodeIds = collectReachableNodeIds(
      nodeId,
      state.edges,
      "upstream"
    )
    const requiredNodes = state.nodes.filter((node) => requiredNodeIds.has(node.id))
    const requiredEdges = state.edges.filter(
      (edge) => requiredNodeIds.has(edge.source) && requiredNodeIds.has(edge.target)
    )
    const { sorted, hasCycle } = topologicalSort(requiredNodes, requiredEdges)
    if (hasCycle) {
      console.warn("Canvas contains cycles — skipped cyclic nodes")
    }

    const skippedNodes = new Set<string>()
    for (const node of sorted) {
      if (executionRevision !== planRevision) return
      const dependsOnSkippedNode = requiredEdges.some(
        (edge) => edge.target === node.id && skippedNodes.has(edge.source)
      )
      if (!includeManual && (isManualNode(node) || dependsOnSkippedNode)) {
        skippedNodes.add(node.id)
        continue
      }

      await get().executeNode(node.id, undefined, false, includeManual)
      if (executionRevision !== planRevision) return
    }
  },

  executeStep: async (includeManual = true) => {
    const planRevision = executionRevision
    const state = get()
    const { sorted, hasCycle } = topologicalSort(state.nodes, state.edges)
    if (hasCycle) {
      console.warn("Canvas contains cycles — skipped cyclic nodes")
    }

    const skippedNodes = new Set<string>()
    const executableNodes = sorted.filter((node) => {
      const dependsOnSkippedNode = state.edges.some(
        (edge) => edge.target === node.id && skippedNodes.has(edge.source)
      )
      if (!includeManual && (isManualNode(node) || dependsOnSkippedNode)) {
        skippedNodes.add(node.id)
        return false
      }
      return true
    })

    if (executableNodes.length === 0) {
      stepExecutionRevision = planRevision
      stepExecutionIndex = 0
      set({ stepProgress: emptyStepProgress() })
      return
    }

    if (
      stepExecutionRevision !== planRevision ||
      stepExecutionIndex >= executableNodes.length
    ) {
      stepExecutionRevision = planRevision
      stepExecutionIndex = 0
    }

    const node = executableNodes[stepExecutionIndex]
    await get().executeNode(node.id, undefined, false, includeManual)
    if (executionRevision !== planRevision) return

    stepExecutionIndex += 1
    set({
      stepProgress: {
        current: stepExecutionIndex,
        total: executableNodes.length,
        nextNodeId: executableNodes[stepExecutionIndex]?.id ?? null,
      },
    })
  },

  setAutoRun: (enabled) => {
    if (!enabled) clearAllNodeExecutionTimers()
    set({ autoRun: enabled })
  },

  clearExecutionLog: () => set({ executionLog: [] }),

  saveToLocalStorage: () => {
    const state = get()
    try {
      localStorage.setItem(
        "canvas-state",
        JSON.stringify({ nodes: state.nodes, edges: state.edges })
      )
    } catch (error) {
      console.warn("Unable to persist canvas state", error)
    }
  },

  loadFromLocalStorage: () => {
    const saved = localStorage.getItem("canvas-state")
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        const normalized = normalizeWorkflowData(parsed)
        if (!normalized) return
        const { nodes, edges } = normalized
        invalidateExecutionPlan()
        resetConfigHistoryGroup()
        clearAllNodeExecutionTimers()
        nodeExecVersion.clear()
        activeNodeRunTokens.clear()
        undoStack.length = 0
        redoStack.length = 0
        set((state) => ({
          nodes,
          edges,
          nodeOutputs: {},
          nodeErrors: {},
          nodeRunning: {},
          executionLog: cancelRunningExecutionLogs(state.executionLog, Date.now()),
          selectedNodeId: null,
          selectedNodeIds: [],
          canUndo: false,
          canRedo: false,
          stepProgress: emptyStepProgress(),
        }))
        if (get().autoRun) {
          setTimeout(() => {
            if (get().autoRun) get().executeAll(false)
          }, 0)
        }
      } catch {}
    }
  },

  replaceWorkflow: ({ nodes, edges }) => {
    invalidateExecutionPlan()
    resetConfigHistoryGroup()
    get().pushHistory()
    clearAllNodeExecutionTimers()
    nodeExecVersion.clear()
    activeNodeRunTokens.clear()
    set((state) => ({
      nodes,
      edges,
      nodeOutputs: {},
      nodeErrors: {},
      nodeRunning: {},
      executionLog: cancelRunningExecutionLogs(state.executionLog, Date.now()),
      selectedNodeId: null,
      selectedNodeIds: [],
      stepProgress: emptyStepProgress(),
    }))
    debouncedSave(() => get().saveToLocalStorage())
    if (get().autoRun) {
      setTimeout(() => {
        if (get().autoRun) get().executeAll(false)
      }, 0)
    }
  },

  clearCanvas: () => {
    const state = get()
    if (state.nodes.length === 0 && state.edges.length === 0) return
    invalidateExecutionPlan()
    resetConfigHistoryGroup()
    get().pushHistory()
    clearAllNodeExecutionTimers()
    nodeExecVersion.clear()
    activeNodeRunTokens.clear()
    set((state) => ({
      nodes: [],
      edges: [],
      nodeOutputs: {},
      nodeErrors: {},
      nodeRunning: {},
      executionLog: cancelRunningExecutionLogs(state.executionLog, Date.now()),
      selectedNodeId: null,
      selectedNodeIds: [],
      stepProgress: emptyStepProgress(),
    }))
    debouncedSave(() => get().saveToLocalStorage())
  },
}))
