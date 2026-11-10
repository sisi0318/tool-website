"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  MiniMap,
  Panel,
  SelectionMode,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Edge as FlowEdge,
  type FitViewOptions,
  type Node as FlowNode,
  type FinalConnectionState,
  type NodeTypes,
} from "@xyflow/react"
import {
  BoxSelect,
  CircleSlash2,
  ClipboardPaste,
  Copy,
  CopyPlus,
  GitBranchPlus,
  Maximize2,
  MousePointerClick,
  Network,
  Play,
  Plus,
  Power,
  Redo2,
  Scan,
  SlidersHorizontal,
  Trash2,
  Undo2,
} from "lucide-react"
import { useCanvasStore } from "@/lib/canvas/store"
import { useShallow } from "zustand/react/shallow"
import { getNodeDefinition } from "@/lib/canvas/registry"
import { createCanvasNode } from "@/lib/canvas/node-factory"
import { autoLayoutNodes } from "@/lib/canvas/auto-layout"
import { readLocalStorage, removeLocalStorage, writeLocalStorage } from "@/lib/safe-storage"
import type { DataType, NodeDefinition } from "@/lib/canvas/types"
import { useMediaQuery } from "@/hooks/use-media-query"
import { useTranslations } from "@/hooks/use-translations"
import { zhCanvas } from "@/lib/translations/zh-namespaces/canvas"
import { BaseNode } from "./nodes/BaseNode"
import { ToolNode } from "./nodes/ToolNode"
import { CanvasContextMenu, type CanvasMenuEntry } from "./CanvasContextMenu"
import { CanvasHeader } from "./CanvasHeader"
import {
  CompatibleNodePicker,
  type CompatibleNodeSelection,
} from "./CompatibleNodePicker"
import { ExecutionLogPanel } from "./ExecutionLogPanel"
import { NodeActionsToolbar } from "./NodeActionsToolbar"
import { NodeDock } from "./NodeDock"
import { PropertyPanel } from "./PropertyPanel"
import { QuickAddMenu } from "./QuickAddMenu"
import { RunBar } from "./RunBar"
import { SelectionToolbar } from "./SelectionToolbar"
import { ViewBar } from "./ViewBar"
import { FIT_CANVAS_EVENT } from "./canvas-events"
import { formatShortcut } from "./chrome"
import { useCanvasClipboard } from "./use-canvas-clipboard"
import { useCanvasConnect } from "./use-canvas-connect"
import { getSourcePorts, useFlowElements } from "./use-flow-elements"
import { useNodeLibrary } from "./use-node-library"

const nodeTypes: NodeTypes = {
  base: BaseNode,
  tool: ToolNode,
}

interface Point {
  x: number
  y: number
}

interface PendingNodeInsert {
  sourceNodeId: string
  sourcePortId: string
  sourceDataType: DataType
  screenPosition: Point
  flowPosition: Point
}

/** 右键点在哪儿：空白处、一个节点上、还是一组选中的节点上 */
type ContextMenuState =
  | { kind: "pane"; screen: Point; flow: Point }
  | { kind: "node"; screen: Point; nodeId: string }
  | { kind: "selection"; screen: Point }

/** “+”接着往下加节点时，新节点离来源节点的距离 */
const APPEND_GAP = 80
/** 选中的节点和右侧属性卡片之间至少留这么宽，放得下节点右边的“+” */
const INSPECTOR_CLEARANCE = 72
const FIT_MAX_ZOOM = 1
/** 已在 lib/storage/app-storage.ts 登记 */
const CANVAS_MINIMAP_KEY = "canvas-minimap"
const NODE_WIDTH_ESTIMATE = 280

function getEventClientPosition(event: MouseEvent | TouchEvent) {
  if ("changedTouches" in event) {
    const touch = event.changedTouches[0]
    return touch ? { x: touch.clientX, y: touch.clientY } : null
  }
  return { x: event.clientX, y: event.clientY }
}

/** “+”和右键菜单里“接着处理”用的输出：有运算结果就用结果，基础节点用它的值 */
function getPrimaryOutput(definition: NodeDefinition) {
  return definition.outputs[0] ?? definition.config.find((field) => field.hasOutput)
}

/**
 * “适应画布”时四周留出的空：上下左右都有浮动的工具条，贴边的节点会被盖住。
 * 手机上左侧没有节点栏，留得少一些。
 */
function getFitPadding(): FitViewOptions["padding"] {
  const wide = typeof window !== "undefined"
    && typeof window.matchMedia === "function"
    && window.matchMedia("(min-width: 1024px)").matches
  return wide
    ? { top: "84px", right: "40px", bottom: "84px", left: "104px" }
    : { top: "76px", right: "20px", bottom: "76px", left: "20px" }
}

export function Canvas() {
  const t = useTranslations("canvas", zhCanvas)
  // 只订阅画布真正用到的切片。整个 store 解构会让每次节点输出、日志、进度更新
  // 都重渲染整张画布(含 flowNodes / flowEdges 的重新映射)。
  const {
    nodes: storeNodes,
    edges: storeEdges,
    addNode,
    addSubgraph,
    updateNodePosition,
    updateNodePositions,
    removeNodes,
    removeEdge,
    selectedNodeId,
    selectedNodeIds,
    nodeRunning,
    selectNodes,
    executeToNode,
    setNodeDisabled,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useCanvasStore(
    useShallow((s) => ({
      nodes: s.nodes,
      edges: s.edges,
      addNode: s.addNode,
      addSubgraph: s.addSubgraph,
      updateNodePosition: s.updateNodePosition,
      updateNodePositions: s.updateNodePositions,
      removeNodes: s.removeNodes,
      removeEdge: s.removeEdge,
      selectedNodeId: s.selectedNodeId,
      selectedNodeIds: s.selectedNodeIds,
      nodeRunning: s.nodeRunning,
      selectNodes: s.selectNodes,
      executeToNode: s.executeToNode,
      setNodeDisabled: s.setNodeDisabled,
      undo: s.undo,
      redo: s.redo,
      canUndo: s.canUndo,
      canRedo: s.canRedo,
    })),
  )
  const { screenToFlowPosition, fitView, getNodes, getViewport, setViewport } = useReactFlow()
  const reactFlowInstance = useReactFlow()
  const library = useNodeLibrary()
  const inspectorRef = useRef<HTMLDivElement>(null)
  const pointerDownRef = useRef(false)

  // Exposed for e2e tests (same pattern as window.__ZUSTAND_STORE__)
  useEffect(() => {
    ;(window as unknown as Record<string, unknown>).__REACT_FLOW_INSTANCE__ =
      reactFlowInstance
  }, [reactFlowInstance])

  const [pendingNodeInsert, setPendingNodeInsert] = useState<PendingNodeInsert | null>(null)
  const [executionLogOpen, setExecutionLogOpen] = useState(false)
  // 小地图默认收着；打开过就记住（这个组件只在浏览器里渲染，可以直接读）
  const [minimapOpen, setMinimapOpen] = useState(() => readLocalStorage(CANVAS_MINIMAP_KEY) === "1")
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [quickAdd, setQuickAdd] = useState<{ screen: Point; flow: Point } | null>(null)
  const isDesktop = useMediaQuery("(min-width: 1024px)")
  // 用户对“当前选中的这个节点”的属性卡片做的选择：关掉了，或者点开了。
  // 换一个节点选中就回到默认，所以关掉一次不会让它从此不再出现。
  const [inspectorChoice, setInspectorChoice] = useState<{ nodeId: string; open: boolean } | null>(null)
  const layoutFitPendingRef = useRef(false)
  const layoutFitFrameRef = useRef<number | null>(null)
  const [fitRequests, setFitRequests] = useState(0)
  // 只有进入页面时画布上已经有节点（上次留下的、从旅程带过来的），才自动适应一次视野。
  // 空画布不排这次适应：React Flow 会把它留到第一个节点出现时才做，
  // 于是双击或拖进来的第一个节点刚落下，镜头就把它挪到了屏幕中间。
  const [fitOnLoad] = useState(() => useCanvasStore.getState().nodes.length > 0)
  const [connectionFeedback, setConnectionFeedback] = useState<{
    message: string
    tone: "error" | "success"
  } | null>(null)
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initialFitOptions = useMemo<FitViewOptions>(() => ({ padding: getFitPadding(), maxZoom: FIT_MAX_ZOOM }), [])

  const inspectorNodeId = selectedNodeIds.length === 1 ? selectedNodeId : null
  // 默认：桌面上卡片跟着选中出现。手机上它是盖住大半屏的抽屉，每选中一次就弹出来
  // 会挡住节点旁边的工具条和“+”，所以要从工具条上的「属性」点开。
  const inspectorOpen = inspectorNodeId !== null
    && (inspectorChoice?.nodeId === inspectorNodeId ? inspectorChoice.open : isDesktop)
  const setInspectorOpen = useCallback((nodeId: string, open: boolean) => {
    setInspectorChoice({ nodeId, open })
  }, [])

  useEffect(() => {
    setInspectorChoice(null)
  }, [selectedNodeId])

  const toggleMinimap = useCallback(() => {
    const next = !minimapOpen
    setMinimapOpen(next)
    if (next) writeLocalStorage(CANVAS_MINIMAP_KEY, "1")
    else removeLocalStorage(CANVAS_MINIMAP_KEY)
  }, [minimapOpen])

  useEffect(() => {
    const press = () => { pointerDownRef.current = true }
    const release = () => { pointerDownRef.current = false }
    window.addEventListener("pointerdown", press, true)
    window.addEventListener("pointerup", release, true)
    window.addEventListener("pointercancel", release, true)
    return () => {
      window.removeEventListener("pointerdown", press, true)
      window.removeEventListener("pointerup", release, true)
      window.removeEventListener("pointercancel", release, true)
    }
  }, [])

  // 属性卡片浮在画布右侧：选中的节点正好在它底下时，把画布往左挪一点让节点露出来。
  // 手机上卡片是底部抽屉，后面的画布本来就不能操作，不用挪。
  useEffect(() => {
    if (!inspectorOpen || !inspectorNodeId) return
    let frame = 0
    const reveal = () => {
      frame = requestAnimationFrame(() => {
        const card = inspectorRef.current
        const nodeElement = Array.from(document.querySelectorAll<HTMLElement>(".react-flow__node"))
          .find((element) => element.dataset.id === inspectorNodeId)
        if (!card || !nodeElement || getComputedStyle(card).position === "fixed") return

        const cardRect = card.getBoundingClientRect()
        const nodeRect = nodeElement.getBoundingClientRect()
        const besideCard = nodeRect.bottom > cardRect.top && nodeRect.top < cardRect.bottom
        // 节点右边还有“+”按钮，一并留出来
        const overlap = nodeRect.right + INSPECTOR_CLEARANCE - cardRect.left
        if (!besideCard || overlap <= 0) return

        const viewport = getViewport()
        void setViewport({ ...viewport, x: viewport.x - overlap }, { duration: 200 })
      })
    }

    // 鼠标还按着（点选的同时多半就在拖这个节点）：等松手再看，免得拖到一半画布自己动
    if (pointerDownRef.current) {
      window.addEventListener("pointerup", reveal, { once: true })
      return () => {
        window.removeEventListener("pointerup", reveal)
        cancelAnimationFrame(frame)
      }
    }
    reveal()
    return () => cancelAnimationFrame(frame)
  }, [getViewport, inspectorNodeId, inspectorOpen, setViewport])

  const closeExecutionLog = useCallback(() => {
    setExecutionLogOpen(false)
    requestAnimationFrame(() => {
      document.querySelector<HTMLButtonElement>("[data-execution-log-toggle]")?.focus()
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

  const { copySelection, pasteSelection, duplicateSelection, hasClipboard } = useCanvasClipboard(showConnectionFeedback, t)
  const onConnect = useCanvasConnect(showConnectionFeedback, t)

  const { flowNodes, flowEdges } = useFlowElements({
    nodes: storeNodes,
    edges: storeEdges,
    selectedNodeIds,
    nodeRunning,
  })

  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>(flowNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>(flowEdges)

  useEffect(() => {
    // 保留 React Flow 量出来的尺寸,否则每次 store 变更都会让所有节点重新测量。
    setNodes((previous) => {
      const measuredById = new Map(previous.map((node) => [node.id, node.measured]))
      return flowNodes.map((node) => {
        const measured = measuredById.get(node.id)
        return measured ? { ...node, measured } : node
      })
    })
  }, [flowNodes, setNodes])

  useEffect(() => {
    // 边的选中状态只存在于 React Flow 本地状态里。整体替换会把它抹掉,
    // 于是选中一条边后任何 store 变更(节点开始/结束运行、拖动)都会让 Delete 失效。
    setEdges((previous) => {
      const selectedIds = new Set(
        previous.filter((edge) => edge.selected).map((edge) => edge.id),
      )
      return flowEdges.map((edge) =>
        selectedIds.has(edge.id) ? { ...edge, selected: true } : edge,
      )
    })
  }, [flowEdges, setEdges])

  // “适应”只负责把内容都收进视野：节点少的时候不为了铺满而放大过 100%
  const fitAll = useCallback(() => {
    void fitView({ padding: getFitPadding(), maxZoom: FIT_MAX_ZOOM, duration: 250 })
  }, [fitView])

  const zoomToSelection = useCallback(() => {
    if (selectedNodeIds.length === 0) return
    void fitView({
      nodes: selectedNodeIds.map((id) => ({ id })),
      padding: getFitPadding(),
      maxZoom: 1.5,
      duration: 250,
    })
  }, [fitView, selectedNodeIds])

  // 读取、导入换了一整张图：等新节点画出来以后适应一次（和自动排列走同一条路）
  useEffect(() => {
    const requestFit = () => {
      layoutFitPendingRef.current = true
      setFitRequests((count) => count + 1)
    }
    window.addEventListener(FIT_CANVAS_EVENT, requestFit)
    return () => window.removeEventListener(FIT_CANVAS_EVENT, requestFit)
  }, [])

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
      void fitView({ padding: getFitPadding(), maxZoom: FIT_MAX_ZOOM, duration: 300 })
    })

    return () => {
      if (layoutFitFrameRef.current !== null) {
        cancelAnimationFrame(layoutFitFrameRef.current)
        layoutFitFrameRef.current = null
      }
    }
  }, [fitRequests, fitView, nodes, storeNodes])

  const selectedEdgeIds = useMemo(
    () => edges.filter((edge) => edge.selected).map((edge) => edge.id),
    [edges]
  )

  const deleteSelection = useCallback(() => {
    let handled = false
    if (selectedNodeIds.length > 0) {
      removeNodes(selectedNodeIds)
      selectNodes([])
      handled = true
    }
    // Edges are selectable but not covered by deleteKeyCode (disabled so node
    // deletion stays store-driven), so remove them here too.
    if (selectedEdgeIds.length > 0) {
      for (const edgeId of selectedEdgeIds) {
        removeEdge(edgeId)
      }
      handled = true
    }
    return handled
  }, [removeNodes, selectNodes, selectedEdgeIds, selectedNodeIds, removeEdge])

  const selectAll = useCallback(() => {
    selectNodes(storeNodes.map((node) => node.id))
  }, [selectNodes, storeNodes])

  const handleSelectionChange = useCallback(
    ({ nodes: selectedNodes }: { nodes: Array<{ id: string }> }) => {
      const nextIds = selectedNodes.map((node) => node.id)
      selectNodes(nextIds)
    },
    [selectNodes]
  )

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // 事件也可能直接派发在 window / document 上，那时没有 tagName 和 closest
      const target = event.target instanceof HTMLElement ? event.target : null
      const tagName = target?.tagName
      const isTextEntry =
        tagName === "INPUT" ||
        tagName === "TEXTAREA" ||
        tagName === "SELECT" ||
        Boolean(target?.isContentEditable)
      if (isTextEntry) return
      if (target?.closest('[role="dialog"], [role="alertdialog"], [role="menu"], [data-canvas-shortcuts="off"]')) return
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
          selectAll()
        }
        return
      }

      if (modifier && key === "c") {
        // 页面上选中了文字(比如节点预览里的内容)时交给浏览器复制文字,不复制节点
        if (window.getSelection()?.toString()) return
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

      // Shift+1 / Shift+2 打出来的是 ! 和 @（各键盘布局还不一样），所以认按键位置
      if (event.shiftKey && !modifier && !event.altKey && event.code === "Digit1") {
        event.preventDefault()
        fitAll()
        return
      }

      if (event.shiftKey && !modifier && !event.altKey && event.code === "Digit2") {
        event.preventDefault()
        zoomToSelection()
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
    fitAll,
    pasteSelection,
    redo,
    selectAll,
    selectNodes,
    storeNodes,
    undo,
    zoomToSelection,
  ])

  const onEdgesDelete = useCallback(
    (deletedEdges: { id: string }[]) => {
      for (const edge of deletedEdges) {
        removeEdge(edge.id)
      }
    },
    [removeEdge]
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
        ? getSourcePorts(sourceDefinition).find((port) => port.id === connectionState.fromHandle?.id)
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

  /**
   * 从节点右侧的“+”（或右键菜单）接着往下加：用这个节点的主输出去挑能接上的节点。
   * 新节点放在它右边；它已经连着别的下游时，排到最下面那个的下方，不叠在一起。
   */
  const openAppendPicker = useCallback(
    (nodeId: string, screenPosition: Point) => {
      const sourceNode = storeNodes.find((node) => node.id === nodeId)
      const definition = sourceNode ? getNodeDefinition(sourceNode.type) : undefined
      const port = definition ? getPrimaryOutput(definition) : undefined
      if (!sourceNode || !port) return

      const measured = new Map(getNodes().map((node) => [node.id, node.measured]))
      const downstreamIds = new Set(
        storeEdges.filter((edge) => edge.source === nodeId).map((edge) => edge.target)
      )
      const lowestBottom = storeNodes
        .filter((node) => downstreamIds.has(node.id))
        .reduce<number | null>((bottom, node) => {
          const nodeBottom = node.position.y + (measured.get(node.id)?.height ?? 120)
          return bottom === null ? nodeBottom : Math.max(bottom, nodeBottom)
        }, null)

      setPendingNodeInsert({
        sourceNodeId: nodeId,
        sourcePortId: port.id,
        sourceDataType: port.dataType,
        screenPosition,
        flowPosition: {
          x: sourceNode.position.x + (measured.get(nodeId)?.width ?? NODE_WIDTH_ESTIMATE) + APPEND_GAP,
          y: lowestBottom === null ? sourceNode.position.y : lowestBottom + 24,
        },
      })
    },
    [getNodes, storeEdges, storeNodes]
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
      library.recordUse(nodeType)
      setPendingNodeInsert(null)
      showConnectionFeedback(t("nodeInsertedAndConnected"), "success")
    },
    [addSubgraph, library, pendingNodeInsert, selectNodes, showConnectionFeedback, t]
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
  }, [getNodes, showConnectionFeedback, storeEdges, storeNodes, t, updateNodePositions])

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

  const openQuickAdd = useCallback(
    (screen: Point) => {
      setQuickAdd({ screen, flow: screenToFlowPosition(screen) })
    },
    [screenToFlowPosition]
  )

  // React Flow 没有“双击空白处”的回调：挂在最外层，只认落在画布底板上的双击
  const handleDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      if (!(event.target as HTMLElement).classList.contains("react-flow__pane")) return
      openQuickAdd({ x: event.clientX, y: event.clientY })
    },
    [openQuickAdd]
  )

  const handlePaneContextMenu = useCallback(
    (event: React.MouseEvent | MouseEvent) => {
      event.preventDefault()
      const screen = { x: event.clientX, y: event.clientY }
      setContextMenu({ kind: "pane", screen, flow: screenToFlowPosition(screen) })
    },
    [screenToFlowPosition]
  )

  const handleNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: FlowNode) => {
      event.preventDefault()
      const screen = { x: event.clientX, y: event.clientY }
      // 右键点在一组选中的节点里：菜单对整组生效；点在别的节点上：先改选它
      if (selectedNodeIds.length > 1 && selectedNodeIds.includes(node.id)) {
        setContextMenu({ kind: "selection", screen })
        return
      }
      selectNodes([node.id])
      setContextMenu({ kind: "node", screen, nodeId: node.id })
    },
    [selectNodes, selectedNodeIds]
  )

  const handleSelectionContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault()
    setContextMenu({ kind: "selection", screen: { x: event.clientX, y: event.clientY } })
  }, [])

  const selectedNode = inspectorNodeId
    ? storeNodes.find((node) => node.id === inspectorNodeId)
    : undefined
  const selectedDefinition = selectedNode ? getNodeDefinition(selectedNode.type) : undefined
  const selectedCanAppend = Boolean(selectedDefinition && getPrimaryOutput(selectedDefinition))

  const buildContextMenu = (menu: ContextMenuState): CanvasMenuEntry[] => {
    const copyItem = {
      id: "copy",
      label: t("copyNodes"),
      icon: Copy,
      shortcut: formatShortcut("mod+c"),
      onSelect: () => { copySelection() },
    }
    const duplicateItem = {
      id: "duplicate",
      label: t("duplicateNodes"),
      icon: CopyPlus,
      shortcut: formatShortcut("mod+d"),
      onSelect: () => { duplicateSelection() },
    }
    const deleteItem = {
      id: "delete",
      label: t("deleteSelectedNodes"),
      icon: Trash2,
      shortcut: "Delete",
      danger: true,
      onSelect: () => { deleteSelection() },
    }

    if (menu.kind === "pane") {
      return [
        { id: "add", label: t("addNode"), icon: Plus, onSelect: () => setQuickAdd({ screen: menu.screen, flow: menu.flow }) },
        { id: "paste", label: t("pasteNodes"), icon: ClipboardPaste, shortcut: formatShortcut("mod+v"), disabled: !hasClipboard, onSelect: () => { pasteSelection(menu.flow) } },
        { id: "select-all", label: t("selectAllNodes"), icon: BoxSelect, shortcut: formatShortcut("mod+a"), disabled: storeNodes.length === 0, onSelect: selectAll },
        "separator",
        { id: "undo", label: t("undo"), icon: Undo2, shortcut: formatShortcut("mod+z"), disabled: !canUndo, onSelect: undo },
        { id: "redo", label: t("redo"), icon: Redo2, shortcut: formatShortcut("mod+shift+z"), disabled: !canRedo, onSelect: redo },
        "separator",
        { id: "layout", label: t("autoLayout"), icon: Network, disabled: storeNodes.length < 2, onSelect: applyAutoLayout },
        { id: "fit", label: t("fitView"), icon: Maximize2, shortcut: formatShortcut("shift+1"), disabled: storeNodes.length === 0, onSelect: fitAll },
      ]
    }

    if (menu.kind === "selection") {
      return [
        copyItem,
        duplicateItem,
        { id: "zoom", label: t("zoomToSelection"), icon: Scan, shortcut: formatShortcut("shift+2"), onSelect: zoomToSelection },
        "separator",
        deleteItem,
      ]
    }

    const node = storeNodes.find((candidate) => candidate.id === menu.nodeId)
    const definition = node ? getNodeDefinition(node.type) : undefined
    const items: CanvasMenuEntry[] = [
      { id: "run", label: t("runToNode"), icon: Play, disabled: Boolean(nodeRunning[menu.nodeId]), onSelect: () => { void executeToNode(menu.nodeId, true) } },
    ]
    if (definition && getPrimaryOutput(definition)) {
      items.push({ id: "append", label: t("appendNextNode"), icon: GitBranchPlus, onSelect: () => openAppendPicker(menu.nodeId, menu.screen) })
    }
    items.push(
      "separator",
      copyItem,
      duplicateItem,
      node?.disabled
        ? { id: "enable", label: t("enableNode"), icon: Power, onSelect: () => setNodeDisabled(menu.nodeId, false) }
        : { id: "disable", label: t("disableNode"), icon: CircleSlash2, onSelect: () => setNodeDisabled(menu.nodeId, true) },
      { id: "properties", label: t("nodeProperties"), icon: SlidersHorizontal, onSelect: () => setInspectorOpen(menu.nodeId, true) },
      "separator",
      deleteItem,
    )
    return items
  }

  const multiSelected = selectedNodeIds.length > 1

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
        onDoubleClick={handleDoubleClick}
        onPaneContextMenu={handlePaneContextMenu}
        onNodeContextMenu={handleNodeContextMenu}
        onSelectionContextMenu={handleSelectionContextMenu}
        nodeTypes={nodeTypes}
        deleteKeyCode={null}
        selectionOnDrag
        selectionMode={SelectionMode.Partial}
        panOnDrag={[1, 2]}
        panActivationKeyCode=" "
        zoomOnDoubleClick={false}
        fitView={fitOnLoad}
        fitViewOptions={initialFitOptions}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1.5} />
        {connectionFeedback && (
          <Panel
            position="bottom-center"
            className={`${multiSelected ? "!mb-[8.5rem] lg:!mb-20" : "!mb-[4.5rem] lg:!mb-5"} max-w-[calc(100%-1rem)]`}
          >
            <div
              role={connectionFeedback.tone === "error" ? "alert" : "status"}
              className={`rounded-[var(--md-sys-shape-corner-medium)] border px-3 py-2 text-sm shadow-lg ${
                connectionFeedback.tone === "success"
                  ? "border-md-success bg-md-success-container text-md-on-success-container"
                  : "border-md-error bg-md-error-container text-md-on-error-container"
              }`}
            >
              {connectionFeedback.tone === "error" && (
                <span className="font-medium">{t("connectionInvalid")}：</span>
              )}
              {connectionFeedback.message}
            </div>
          </Panel>
        )}
        {minimapOpen && (
          <MiniMap
            position="bottom-left"
            className="!bottom-[4.25rem] !left-3 !m-0 max-sm:!hidden"
            ariaLabel={t("minimap")}
            pannable
            zoomable
          />
        )}
        {inspectorNodeId && (
          <NodeActionsToolbar
            nodeId={inspectorNodeId}
            canAppend={selectedCanAppend}
            inspectorOpen={inspectorOpen}
            onToggleInspector={() => setInspectorOpen(inspectorNodeId, !inspectorOpen)}
            onDuplicate={() => { duplicateSelection() }}
            onDelete={() => { deleteSelection() }}
            onAppend={(anchor) => openAppendPicker(inspectorNodeId, { x: anchor.right, y: anchor.top })}
          />
        )}
      </ReactFlow>

      {storeNodes.length === 0 && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-6">
          <div className="max-w-xs text-center">
            <MousePointerClick aria-hidden="true" className="mx-auto mb-3 h-8 w-8 text-md-on-surface-variant" />
            <p className="text-base font-medium text-md-on-surface">
              <span className="max-lg:hidden">{t("emptyCanvasTitle")}</span>
              <span className="lg:hidden">{t("emptyCanvasTitleTouch")}</span>
            </p>
            <p className="mt-1.5 text-sm leading-6 text-md-on-surface-variant max-lg:hidden">
              {t("emptyCanvasHint")}
            </p>
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-3 top-3 z-20 flex items-start justify-between gap-2">
        <CanvasHeader />
        <RunBar
          executionLogOpen={executionLogOpen}
          onToggleExecutionLog={() => setExecutionLogOpen((open) => !open)}
        />
      </div>

      <NodeDock library={library} />

      <div className="pointer-events-none absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-3 z-20 flex">
        <ViewBar
          minimapOpen={minimapOpen}
          onToggleMinimap={toggleMinimap}
          onAutoLayout={applyAutoLayout}
          onFitView={fitAll}
          onZoomToSelection={zoomToSelection}
        />
      </div>

      {!executionLogOpen && (
        <SelectionToolbar
          count={selectedNodeIds.length}
          onCopy={() => { copySelection() }}
          onDuplicate={() => { duplicateSelection() }}
          onDelete={() => { deleteSelection() }}
        />
      )}

      {inspectorOpen && (
        <>
          <button
            type="button"
            aria-label={t("close")}
            tabIndex={-1}
            onClick={() => setInspectorOpen(inspectorNodeId, false)}
            className="fixed inset-0 z-30 bg-black/30 backdrop-blur-[1px] lg:hidden"
          />
          <div
            ref={inspectorRef}
            className="fixed inset-x-0 bottom-0 z-40 flex max-h-[72dvh] flex-col lg:absolute lg:inset-x-auto lg:bottom-auto lg:right-3 lg:top-[4.25rem] lg:z-20 lg:max-h-[calc(100%-5rem)] lg:w-80"
          >
            <PropertyPanel onClose={() => setInspectorOpen(inspectorNodeId, false)} />
          </div>
        </>
      )}

      <ExecutionLogPanel
        open={executionLogOpen}
        besideInspector={inspectorOpen}
        onClose={closeExecutionLog}
        onSelectNode={(nodeId) => {
          selectNodes([nodeId])
          closeExecutionLog()
        }}
      />

      {contextMenu && (
        <CanvasContextMenu
          key={`${contextMenu.kind}-${contextMenu.screen.x}-${contextMenu.screen.y}`}
          label={contextMenu.kind === "pane" ? t("canvasMenu") : t("nodeMenu")}
          position={contextMenu.screen}
          items={buildContextMenu(contextMenu)}
          onClose={() => setContextMenu(null)}
        />
      )}
      {quickAdd && (
        <QuickAddMenu
          library={library}
          position={quickAdd.screen}
          onPick={(nodeType) => {
            addNode(createCanvasNode(nodeType, quickAdd.flow))
            library.recordUse(nodeType)
            setQuickAdd(null)
          }}
          onClose={() => setQuickAdd(null)}
        />
      )}
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
