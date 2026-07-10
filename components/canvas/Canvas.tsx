"use client"

import { useCallback, useMemo, useEffect, useRef, useState } from "react"
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Connection,
  type FinalConnectionState,
  type NodeTypes,
} from "@xyflow/react"
import { useCanvasStore } from "@/lib/canvas/store"
import { getNodeDefinition } from "@/lib/canvas/registry"
import {
  validateConnection,
  type ConnectionValidationResult,
} from "@/lib/canvas/validation"
import { TYPE_COLORS } from "@/lib/canvas/types/primitives"
import { createCanvasNode } from "@/lib/canvas/node-factory"
import { autoLayoutNodes } from "@/lib/canvas/auto-layout"
import {
  createClipboardPayload,
  instantiateClipboardPayload,
  type CanvasClipboardPayload,
} from "@/lib/canvas/clipboard"
import type { DataType } from "@/lib/canvas/types"
import { useTranslations } from "@/hooks/use-translations"
import { BaseNode } from "./nodes/BaseNode"
import { ToolNode } from "./nodes/ToolNode"
import { CanvasToolbar } from "./CanvasToolbar"
import {
  CompatibleNodePicker,
  type CompatibleNodeSelection,
} from "./CompatibleNodePicker"
import { ExecutionLogPanel } from "./ExecutionLogPanel"
import { SelectionToolbar } from "./SelectionToolbar"

const nodeTypes: NodeTypes = {
  base: BaseNode,
  tool: ToolNode,
}

interface PendingNodeInsert {
  sourceNodeId: string
  sourcePortId: string
  sourceDataType: DataType
  screenPosition: { x: number; y: number }
  flowPosition: { x: number; y: number }
}

function getEventClientPosition(event: MouseEvent | TouchEvent) {
  if ("changedTouches" in event) {
    const touch = event.changedTouches[0]
    return touch ? { x: touch.clientX, y: touch.clientY } : null
  }
  return { x: event.clientX, y: event.clientY }
}

export function Canvas() {
  const t = useTranslations("canvas")
  const {
    nodes: storeNodes,
    edges: storeEdges,
    addNode,
    addSubgraph,
    addEdge: addStoreEdge,
    updateNodePosition,
    updateNodePositions,
    removeNodes,
    removeEdge,
    selectedNodeIds,
    nodeRunning,
    selectNodes,
    undo,
    redo,
  } = useCanvasStore()
  const { screenToFlowPosition, fitView, getNodes } = useReactFlow()
  const [pendingNodeInsert, setPendingNodeInsert] = useState<PendingNodeInsert | null>(null)
  const [executionLogOpen, setExecutionLogOpen] = useState(false)
  const clipboardRef = useRef<CanvasClipboardPayload | null>(null)
  const pasteSequenceRef = useRef(0)
  const layoutFitPendingRef = useRef(false)
  const layoutFitFrameRef = useRef<number | null>(null)
  const [connectionFeedback, setConnectionFeedback] = useState<{
    message: string
    tone: "error" | "success"
  } | null>(null)
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const closeExecutionLog = useCallback(() => {
    setExecutionLogOpen(false)
    requestAnimationFrame(() => {
      document.querySelector<HTMLButtonElement>(
        '[aria-controls="canvas-execution-log"]'
      )?.focus()
    })
  }, [])

  const showConnectionFeedback = useCallback((message: string, tone: "error" | "success" = "error") => {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
    setConnectionFeedback({ message, tone })
    feedbackTimerRef.current = setTimeout(() => {
      setConnectionFeedback(null)
      feedbackTimerRef.current = null
    }, 3500)
  }, [])

  useEffect(() => () => {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
  }, [])

  const getConnectionMessage = useCallback(
    (
      result: ConnectionValidationResult,
      sourceType?: string,
      targetType?: string
    ) => {
      switch (result.code) {
        case "self-connection":
          return t("connectionSelf")
        case "duplicate-connection":
          return t("connectionDuplicate")
        case "target-port-occupied":
          return t("connectionOccupied")
        case "cycle":
          return t("connectionCycle")
        case "incompatible-types":
          return t("connectionIncompatible")
            .replace("{source}", sourceType ?? "?")
            .replace("{target}", targetType ?? "?")
        default:
          return result.message ?? t("connectionIncomplete")
      }
    },
    [t]
  )

  const flowNodes = useMemo(
    () =>
      storeNodes.map((node) => {
        const definition = getNodeDefinition(node.type)
        const isBasic = ["string", "number", "json", "file", "boolean"].includes(node.type)
        return {
          id: node.id,
          type: isBasic ? "base" : "tool",
          position: node.position,
          selected: selectedNodeIds.includes(node.id),
          data: {
            ...node,
            definition,
            selected: selectedNodeIds.includes(node.id),
          },
        }
      }),
    [storeNodes, selectedNodeIds]
  )

  const flowEdges = useMemo(
    () => storeEdges.map((edge) => {
      const sourceNode = storeNodes.find((node) => node.id === edge.source)
      const definition = sourceNode ? getNodeDefinition(sourceNode.type) : undefined
      const sourcePort = definition
        ? [
            ...definition.config.filter((field) => field.hasOutput),
            ...definition.outputs,
          ].find((port) => port.id === edge.sourcePort)
        : undefined
      const isRunning = Boolean(nodeRunning[edge.source] || nodeRunning[edge.target])

      return {
        id: edge.id,
        source: edge.source,
        sourceHandle: edge.sourcePort,
        target: edge.target,
        targetHandle: edge.targetPort,
        animated: isRunning,
        style: {
          stroke: TYPE_COLORS[sourcePort?.dataType ?? "string"],
          strokeWidth: 2,
        },
      }
    }),
    [storeEdges, storeNodes, nodeRunning]
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(flowEdges)

  useEffect(() => {
    setNodes(flowNodes)
  }, [flowNodes, setNodes])

  useEffect(() => {
    setEdges(flowEdges)
  }, [flowEdges, setEdges])

  useEffect(() => {
    if (!layoutFitPendingRef.current) return
    const renderedPositions = new Map(
      nodes.map((node) => [node.id, node.position])
    )
    const positionsSynced = storeNodes.every((node) => {
      const rendered = renderedPositions.get(node.id)
      return rendered?.x === node.position.x && rendered?.y === node.position.y
    })
    if (!positionsSynced) return

    layoutFitPendingRef.current = false
    layoutFitFrameRef.current = requestAnimationFrame(() => {
      layoutFitFrameRef.current = null
      void fitView({ padding: 0.15, duration: 300 })
    })

    return () => {
      if (layoutFitFrameRef.current !== null) {
        cancelAnimationFrame(layoutFitFrameRef.current)
        layoutFitFrameRef.current = null
      }
    }
  }, [fitView, nodes, storeNodes])

  const getSelectedIds = useCallback(() => {
    return selectedNodeIds
  }, [selectedNodeIds])

  const insertClipboardPayload = useCallback(
    (payload: CanvasClipboardPayload, offsetMultiplier = 1) => {
      const pasted = instantiateClipboardPayload(payload, {
        x: 40 * offsetMultiplier,
        y: 40 * offsetMultiplier,
      })
      if (pasted.nodes.length === 0) return []

      addSubgraph(pasted)
      const pastedIds = pasted.nodes.map((node) => node.id)
      selectNodes(pastedIds)
      return pastedIds
    },
    [addSubgraph, selectNodes]
  )

  const copySelection = useCallback(() => {
    const ids = getSelectedIds()
    if (ids.length === 0) return false

    const payload = createClipboardPayload(
      storeNodes,
      storeEdges,
      new Set(ids)
    )
    if (payload.nodes.length === 0) return false

    clipboardRef.current = payload
    pasteSequenceRef.current = 0
    showConnectionFeedback(
      t("nodesCopied").replace("{count}", String(payload.nodes.length)),
      "success"
    )
    return true
  }, [getSelectedIds, showConnectionFeedback, storeEdges, storeNodes, t])

  const pasteSelection = useCallback(() => {
    if (!clipboardRef.current) return false
    pasteSequenceRef.current += 1
    const pastedIds = insertClipboardPayload(
      clipboardRef.current,
      pasteSequenceRef.current
    )
    if (pastedIds.length === 0) return false

    showConnectionFeedback(
      t("nodesPasted").replace("{count}", String(pastedIds.length)),
      "success"
    )
    return true
  }, [insertClipboardPayload, showConnectionFeedback, t])

  const duplicateSelection = useCallback(() => {
    const ids = getSelectedIds()
    if (ids.length === 0) return false
    const payload = createClipboardPayload(storeNodes, storeEdges, new Set(ids))
    const pastedIds = insertClipboardPayload(payload)
    if (pastedIds.length === 0) return false

    showConnectionFeedback(
      t("nodesDuplicated").replace("{count}", String(pastedIds.length)),
      "success"
    )
    return true
  }, [getSelectedIds, insertClipboardPayload, showConnectionFeedback, storeEdges, storeNodes, t])

  const deleteSelection = useCallback(() => {
    const ids = getSelectedIds()
    if (ids.length === 0) return false
    removeNodes(ids)
    selectNodes([])
    return true
  }, [getSelectedIds, removeNodes, selectNodes])

  const handleSelectionChange = useCallback(
    ({ nodes: selectedNodes }: { nodes: Array<{ id: string }> }) => {
      const nextIds = selectedNodes.map((node) => node.id)
      selectNodes(nextIds)
    },
    [selectNodes]
  )

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      const tagName = target.tagName
      const isTextEntry =
        tagName === "INPUT" ||
        tagName === "TEXTAREA" ||
        tagName === "SELECT" ||
        target.isContentEditable
      if (isTextEntry) return
      if (target.closest('[role="dialog"], [data-canvas-shortcuts="off"]')) return
      const isButton = tagName === "BUTTON"

      const modifier = event.ctrlKey || event.metaKey
      const key = event.key.toLowerCase()

      if (
        !isButton &&
        (event.key === "Delete" || event.key === "Backspace") &&
        deleteSelection()
      ) {
        event.preventDefault()
        return
      }

      if (modifier && key === "a") {
        if (storeNodes.length > 0) {
          event.preventDefault()
          const ids = storeNodes.map((node) => node.id)
          selectNodes(ids)
        }
        return
      }

      if (modifier && key === "c") {
        if (copySelection()) event.preventDefault()
        return
      }

      if (modifier && key === "v") {
        if (pasteSelection()) event.preventDefault()
        return
      }

      if (modifier && key === "d") {
        if (duplicateSelection()) event.preventDefault()
        return
      }

      if (modifier && key === "z" && !event.shiftKey) {
        event.preventDefault()
        undo()
        return
      }

      if (modifier && ((key === "z" && event.shiftKey) || key === "y")) {
        event.preventDefault()
        redo()
        return
      }

      if (event.key === "Escape") {
        selectNodes([])
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [
    copySelection,
    deleteSelection,
    duplicateSelection,
    pasteSelection,
    redo,
    selectNodes,
    storeNodes,
    undo,
  ])

  const onEdgesDelete = useCallback(
    (deletedEdges: { id: string }[]) => {
      for (const edge of deletedEdges) {
        removeEdge(edge.id)
      }
    },
    [removeEdge]
  )

  const onConnect = useCallback(
    (connection: Connection) => {
      if (
        !connection.source ||
        !connection.target ||
        !connection.sourceHandle ||
        !connection.targetHandle
      ) {
        showConnectionFeedback(t("connectionIncomplete"))
        return
      }

      const sourceNode = storeNodes.find((n) => n.id === connection.source)
      const targetNode = storeNodes.find((n) => n.id === connection.target)
      if (!sourceNode || !targetNode) {
        showConnectionFeedback(t("connectionMissingNode"))
        return
      }

      const sourceDef = getNodeDefinition(sourceNode.type)
      const targetDef = getNodeDefinition(targetNode.type)
      if (!sourceDef || !targetDef) {
        showConnectionFeedback(t("connectionMissingNode"))
        return
      }

      // Find source config field (has hasOutput=true) or derived output
      const sourceField = sourceDef.config.find(
        (f) => f.id === connection.sourceHandle && f.hasOutput
      )
      const sourceOutput = sourceDef.outputs.find(
        (o) => o.id === connection.sourceHandle
      )
      const targetField = targetDef.config.find(
        (f) => f.id === connection.targetHandle && f.hasInput
      )

      if ((!sourceField && !sourceOutput) || !targetField) {
        showConnectionFeedback(t("connectionMissingPort"))
        return
      }

      // Create the source field-like object for validation
      const sourceForValidation = sourceField ?? {
        id: sourceOutput!.id,
        name: sourceOutput!.name,
        dataType: sourceOutput!.dataType,
      }

      const result = validateConnection(sourceForValidation, targetField, {
        existingEdges: storeEdges,
        connection: {
          source: connection.source,
          sourcePort: connection.sourceHandle,
          target: connection.target,
          targetPort: connection.targetHandle,
        },
      })
      const replacesExistingInput = result.code === "target-port-occupied"
      if (!result.valid && !replacesExistingInput) {
        showConnectionFeedback(
          getConnectionMessage(result, sourceForValidation.dataType, targetField.dataType)
        )
        return
      }

      const newEdge = {
        id: `edge-${connection.source}-${connection.sourceHandle}-${connection.target}-${connection.targetHandle}`,
        source: connection.source,
        sourcePort: connection.sourceHandle,
        target: connection.target,
        targetPort: connection.targetHandle,
      }
      addStoreEdge(newEdge)
      if (replacesExistingInput) {
        showConnectionFeedback(t("connectionReplaced"), "success")
      }
    },
    [
      storeNodes,
      storeEdges,
      addStoreEdge,
      getConnectionMessage,
      showConnectionFeedback,
      t,
    ]
  )

  const handleConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent, connectionState: FinalConnectionState) => {
      if (
        connectionState.toNode ||
        !connectionState.fromNode ||
        !connectionState.fromHandle ||
        connectionState.fromHandle.type !== "source" ||
        !connectionState.fromHandle.id
      ) {
        return
      }

      const sourceNode = storeNodes.find(
        (node) => node.id === connectionState.fromNode?.id
      )
      const sourceDefinition = sourceNode
        ? getNodeDefinition(sourceNode.type)
        : undefined
      const sourcePort = sourceDefinition
        ? [
            ...sourceDefinition.config.filter((field) => field.hasOutput),
            ...sourceDefinition.outputs,
          ].find((port) => port.id === connectionState.fromHandle?.id)
        : undefined
      const screenPosition = getEventClientPosition(event)
      if (!sourceNode || !sourcePort || !screenPosition) return

      setPendingNodeInsert({
        sourceNodeId: sourceNode.id,
        sourcePortId: connectionState.fromHandle.id,
        sourceDataType: sourcePort.dataType,
        screenPosition,
        flowPosition: screenToFlowPosition(screenPosition),
      })
    },
    [screenToFlowPosition, storeNodes]
  )

  const insertCompatibleNode = useCallback(
    ({ nodeType, targetPortId }: CompatibleNodeSelection) => {
      if (!pendingNodeInsert) return
      const newNode = createCanvasNode(nodeType, pendingNodeInsert.flowPosition)
      const newEdge = {
        id: `edge-${pendingNodeInsert.sourceNodeId}-${pendingNodeInsert.sourcePortId}-${newNode.id}-${targetPortId}`,
        source: pendingNodeInsert.sourceNodeId,
        sourcePort: pendingNodeInsert.sourcePortId,
        target: newNode.id,
        targetPort: targetPortId,
      }

      addSubgraph({ nodes: [newNode], edges: [newEdge] })
      selectNodes([newNode.id])
      setPendingNodeInsert(null)
      showConnectionFeedback(t("nodeInsertedAndConnected"), "success")
    },
    [addSubgraph, pendingNodeInsert, selectNodes, showConnectionFeedback, t]
  )

  const applyAutoLayout = useCallback(() => {
    if (storeNodes.length < 2) return

    const measuredNodes = new Map(getNodes().map((node) => [
      node.id,
      node.measured,
    ]))
    const laidOutNodes = autoLayoutNodes(storeNodes, storeEdges, {
      getNodeSize: (node) => measuredNodes.get(node.id),
    })
    layoutFitPendingRef.current = true
    updateNodePositions(
      laidOutNodes.map((node) => ({ id: node.id, position: node.position }))
    )
    showConnectionFeedback(t("autoLayoutApplied"), "success")
  }, [fitView, getNodes, showConnectionFeedback, storeEdges, storeNodes, t, updateNodePositions])

  const handleNodesChange = useCallback(
    (changes: Parameters<typeof onNodesChange>[0]) => {
      onNodesChange(changes)

      const settledPositions = changes.flatMap((change) => {
        if (change.type !== "position" || !change.position || change.dragging) return []
        return [{ id: change.id, position: change.position }]
      })

      if (settledPositions.length > 1) {
        updateNodePositions(settledPositions)
      } else if (settledPositions.length === 1) {
        updateNodePosition(settledPositions[0].id, settledPositions[0].position)
      }
    },
    [
      onNodesChange,
      updateNodePosition,
      updateNodePositions,
    ]
  )

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = "move"
  }, [])

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      event.stopPropagation()
      const type = event.dataTransfer.getData("application/canvas-node")
      if (!type) return

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })

      addNode(createCanvasNode(type, position))
    },
    [screenToFlowPosition, addNode]
  )

  return (
    <div className="relative h-full w-full" data-testid="canvas-drop-zone">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectEnd={handleConnectEnd}
        onSelectionChange={handleSelectionChange}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onEdgesDelete={onEdgesDelete}
        onPaneClick={() => {
          selectNodes([])
        }}
        nodeTypes={nodeTypes}
        deleteKeyCode={null}
        fitView
      >
        <Background />
        <CanvasToolbar
          onAutoLayout={applyAutoLayout}
          onToggleExecutionLog={() => setExecutionLogOpen((open) => !open)}
          executionLogOpen={executionLogOpen}
        />
        {connectionFeedback && (
          <Panel
            position="bottom-center"
            className={`${selectedNodeIds.length > 1 ? "!mb-20" : "!mb-5"} max-w-[calc(100%-1rem)]`}
          >
            <div
              role={connectionFeedback.tone === "error" ? "alert" : "status"}
              className={`rounded-lg border px-3 py-2 text-sm shadow-lg ${
                connectionFeedback.tone === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/90 dark:text-emerald-200"
                  : "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/90 dark:text-red-200"
              }`}
            >
              {connectionFeedback.tone === "error" && (
                <span className="font-medium">{t("connectionInvalid")}：</span>
              )}
              {connectionFeedback.message}
            </div>
          </Panel>
        )}
        <Controls
          className="!bg-gray-800 !border-gray-700 [&>button]:!bg-gray-700 [&>button]:!border-gray-600 [&>button]:!text-gray-200 [&>button:hover]:!bg-gray-600"
        />
        <MiniMap
          className="!hidden !bg-gray-800 !border-gray-700 lg:!block"
          nodeColor="#4b5563"
          maskColor="rgba(0, 0, 0, 0.5)"
        />
      </ReactFlow>
      {!executionLogOpen && (
        <SelectionToolbar
          count={selectedNodeIds.length}
          onCopy={() => { copySelection() }}
          onDuplicate={() => { duplicateSelection() }}
          onDelete={() => { deleteSelection() }}
        />
      )}
      <ExecutionLogPanel
        open={executionLogOpen}
        onClose={closeExecutionLog}
        onSelectNode={(nodeId) => {
          selectNodes([nodeId])
          closeExecutionLog()
        }}
      />
      {pendingNodeInsert && (
        <CompatibleNodePicker
          sourceDataType={pendingNodeInsert.sourceDataType}
          position={pendingNodeInsert.screenPosition}
          onSelect={insertCompatibleNode}
          onClose={() => setPendingNodeInsert(null)}
        />
      )}
    </div>
  )
}
