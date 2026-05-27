"use client"

import { useCallback, useMemo, useEffect } from "react"
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Connection,
  type NodeTypes,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { useCanvasStore } from "@/lib/canvas/store"
import { getNodeDefinition } from "@/lib/canvas/registry"
import { validateConnection } from "@/lib/canvas/validation"
import { BaseNode } from "./nodes/BaseNode"
import { ToolNode } from "./nodes/ToolNode"

const nodeTypes: NodeTypes = {
  base: BaseNode,
  tool: ToolNode,
}

export function Canvas() {
  const {
    nodes: storeNodes,
    edges: storeEdges,
    addNode,
    addEdge: addStoreEdge,
    updateNodePosition,
    removeNode,
    removeEdge,
    selectedNodeId,
  } = useCanvasStore()
  const { screenToFlowPosition } = useReactFlow()

  const flowNodes = useMemo(
    () =>
      storeNodes.map((node) => {
        const definition = getNodeDefinition(node.type)
        const isBasic = ["string", "number", "json", "file", "boolean"].includes(node.type)
        return {
          id: node.id,
          type: isBasic ? "base" : "tool",
          position: node.position,
          data: { ...node, definition },
        }
      }),
    [storeNodes]
  )

  const flowEdges = useMemo(
    () =>
      storeEdges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        sourceHandle: edge.sourcePort,
        target: edge.target,
        targetHandle: edge.targetPort,
        animated: true,
        style: { stroke: "#6b7280" },
      })),
    [storeEdges]
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(flowEdges)

  useEffect(() => {
    setNodes(flowNodes)
  }, [flowNodes, setNodes])

  useEffect(() => {
    setEdges(flowEdges)
  }, [flowEdges, setEdges])

  // Delete key removes selected node
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        const target = e.target as HTMLElement
        if (
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable
        ) {
          return
        }

        if (selectedNodeId) {
          removeNode(selectedNodeId)
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [selectedNodeId, removeNode])

  // Edge delete callback
  const onEdgesDelete = useCallback(
    (deletedEdges: any[]) => {
      for (const edge of deletedEdges) {
        removeEdge(edge.id)
      }
    },
    [removeEdge]
  )

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return

      const sourceNode = storeNodes.find((n) => n.id === connection.source)
      const targetNode = storeNodes.find((n) => n.id === connection.target)
      if (!sourceNode || !targetNode) return

      const sourceDef = getNodeDefinition(sourceNode.type)
      const targetDef = getNodeDefinition(targetNode.type)
      if (!sourceDef || !targetDef) return

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

      if ((!sourceField && !sourceOutput) || !targetField) return

      // Create the source field-like object for validation
      const sourceForValidation = sourceField ?? {
        id: sourceOutput!.id,
        name: sourceOutput!.name,
        dataType: sourceOutput!.dataType,
      }

      const result = validateConnection(sourceForValidation, targetField)
      if (!result.valid) return

      if (result.level === "warning") {
        const proceed = confirm(
          `${result.message}\n\nDo you want to proceed?`
        )
        if (!proceed) return
      }

      const newEdge = {
        id: `edge-${connection.source}-${connection.sourceHandle}-${connection.target}-${connection.targetHandle}`,
        source: connection.source,
        sourcePort: connection.sourceHandle!,
        target: connection.target,
        targetPort: connection.targetHandle!,
      }
      addStoreEdge(newEdge)
      setEdges((eds) => addEdge({ ...connection, animated: true, style: { stroke: "#6b7280" } }, eds))
    },
    [storeNodes, addStoreEdge, setEdges]
  )

  const handleNodesChange = useCallback(
    (changes: any[]) => {
      onNodesChange(changes)
      for (const change of changes) {
        if (change.type === "position" && change.position) {
          updateNodePosition(change.id, change.position)
        }
      }
    },
    [onNodesChange, updateNodePosition]
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

      const newNode = {
        id: `node-${Date.now()}`,
        type,
        position,
        config: {},
      }
      addNode(newNode)
    },
    [screenToFlowPosition, addNode]
  )

  return (
    <div className="w-full h-full" data-testid="canvas-drop-zone">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onEdgesDelete={onEdgesDelete}
        nodeTypes={nodeTypes}
        fitView
      >
        <Background />
        <Controls
          className="!bg-gray-800 !border-gray-700 [&>button]:!bg-gray-700 [&>button]:!border-gray-600 [&>button]:!text-gray-200 [&>button:hover]:!bg-gray-600"
        />
        <MiniMap
          className="!bg-gray-800 !border-gray-700"
          nodeColor="#4b5563"
          maskColor="rgba(0, 0, 0, 0.5)"
        />
      </ReactFlow>
    </div>
  )
}
