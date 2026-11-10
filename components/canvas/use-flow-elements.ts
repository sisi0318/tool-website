"use client"

import { useMemo, useRef } from "react"
import type { Edge as FlowEdge, Node as FlowNode } from "@xyflow/react"
import { getNodeDefinition } from "@/lib/canvas/registry"
import { TYPE_COLORS } from "@/lib/canvas/types/primitives"
import type { Edge as CanvasEdge, NodeDefinition, NodeInstance } from "@/lib/canvas/types"

/** 和选中节点相连、或正在传数据的连线；其余的在样式里调淡（app/globals.css） */
export const ACTIVE_EDGE_CLASS = "canvas-edge-active"

/** 节点能往外连的端口：带输出的参数，加上运算结果 */
export function getSourcePorts(definition: NodeDefinition) {
  return [
    ...definition.config.filter((field) => field.hasOutput),
    ...definition.outputs,
  ]
}

/** “+”和右键菜单里“添加下一步”用的输出：有运算结果就用结果，基础节点用它的值 */
export function getPrimaryOutput(definition: NodeDefinition) {
  return definition.outputs[0] ?? definition.config.find((field) => field.hasOutput)
}

interface FlowElementsInput {
  nodes: NodeInstance[]
  edges: CanvasEdge[]
  selectedNodeIds: string[]
  nodeRunning: Record<string, boolean>
}

/**
 * 把存储里的节点和连线换成 React Flow 要的形状。
 * 两边都按 id 缓存：来源对象和显示状态都没变，就沿用上一次的对象，
 * 已 memo 的节点组件不必重渲染。以前任何一个节点有变化（比如拖动）都会给所有节点新建 data。
 */
export function useFlowElements({ nodes, edges, selectedNodeIds, nodeRunning }: FlowElementsInput) {
  const nodeCache = useRef(new Map<string, { source: NodeInstance; selected: boolean; flow: FlowNode }>())
  const flowNodes = useMemo(() => {
    const previous = nodeCache.current
    const next = new Map<string, { source: NodeInstance; selected: boolean; flow: FlowNode }>()
    const selectedIds = new Set(selectedNodeIds)
    const result = nodes.map((node) => {
      const selected = selectedIds.has(node.id)
      const cached = previous.get(node.id)
      if (cached && cached.source === node && cached.selected === selected) {
        next.set(node.id, cached)
        return cached.flow
      }
      const definition = getNodeDefinition(node.type)
      // 用注册表的类别判断,新增基础节点不必再来这里补名单
      const isBasic = definition?.category === "basic"
      const flow: FlowNode = {
        id: node.id,
        type: isBasic ? "base" : "tool",
        position: node.position,
        selected,
        data: {
          ...node,
          definition,
          selected,
        },
      }
      next.set(node.id, { source: node, selected, flow })
      return flow
    })
    nodeCache.current = next
    return result
  }, [nodes, selectedNodeIds])

  // 运行状态只影响两端在跑的那几条，选中状态只影响和选中节点相连的那几条
  const edgeCache = useRef(new Map<string, { source: CanvasEdge; animated: boolean; active: boolean; stroke: string; flow: FlowEdge }>())
  const flowEdges = useMemo(() => {
    const previous = edgeCache.current
    const next = new Map<string, { source: CanvasEdge; animated: boolean; active: boolean; stroke: string; flow: FlowEdge }>()
    const nodesById = new Map(nodes.map((node) => [node.id, node]))
    const selectedIds = new Set(selectedNodeIds)
    const result = edges.map((edge) => {
      const sourceNode = nodesById.get(edge.source)
      const definition = sourceNode ? getNodeDefinition(sourceNode.type) : undefined
      const sourcePort = definition
        ? getSourcePorts(definition).find((port) => port.id === edge.sourcePort)
        : undefined
      const animated = Boolean(nodeRunning[edge.source] || nodeRunning[edge.target])
      const active = selectedIds.has(edge.source) || selectedIds.has(edge.target)
      const stroke = TYPE_COLORS[sourcePort?.dataType ?? "string"]
      const cached = previous.get(edge.id)
      if (cached && cached.source === edge && cached.animated === animated && cached.active === active && cached.stroke === stroke) {
        next.set(edge.id, cached)
        return cached.flow
      }
      const flow: FlowEdge = {
        id: edge.id,
        source: edge.source,
        sourceHandle: edge.sourcePort,
        target: edge.target,
        targetHandle: edge.targetPort,
        animated,
        className: active ? ACTIVE_EDGE_CLASS : undefined,
        // 粗细和深浅交给样式表（选中、悬停、运行时各不相同），这里只定颜色
        style: { stroke },
      }
      next.set(edge.id, { source: edge, animated, active, stroke, flow })
      return flow
    })
    edgeCache.current = next
    return result
  }, [edges, nodes, nodeRunning, selectedNodeIds])

  return { flowNodes, flowEdges }
}
