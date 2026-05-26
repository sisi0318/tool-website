"use client"

import { useCallback, useMemo } from "react"
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type NodeTypes,
  type EdgeTypes,
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
    addEdge: addStoreEdge,
    updateNodePosition,
  } = useCanvasStore()

  const flowNodes = useMemo(
    () =>
      storeNodes.map((node) => {
        const definition = getNodeDefinition(node.type)
        const isBasic = ["string", "number", "json", "file"].includes(node.type)
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

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return

      const sourceNode = storeNodes.find((n) => n.id === connection.source)
      const targetNode = storeNodes.find((n) => n.id === connection.target)
      if (!sourceNode || !targetNode) return

      const sourceDef = getNodeDefinition(sourceNode.type)
      const targetDef = getNodeDefinition(targetNode.type)
      if (!sourceDef || !targetDef) return

      const sourcePort = sourceDef.outputs.find(
        (p) => p.id === connection.sourceHandle
      )
      const targetPort = targetDef.inputs.find(
        (p) => p.id === connection.targetHandle
      )
      if (!sourcePort || !targetPort) return

      const result = validateConnection(sourcePort, targetPort)
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

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  )
}
