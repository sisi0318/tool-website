import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Edge, NodeDefinition, NodeInstance } from "./types"

type TestHarness = Awaited<ReturnType<typeof createTestHarness>>

async function createTestHarness() {
  vi.resetModules()

  const registry = await import("./registry")
  const { useCanvasStore } = await import("./store")

  registry.clearRegistry()
  useCanvasStore.getState().setAutoRun(false)

  return { registry, useCanvasStore }
}

function node(
  id: string,
  type = "test",
  position = { x: 0, y: 0 },
  config: Record<string, unknown> = {}
): NodeInstance {
  return { id, type, position, config }
}

function edge(
  id: string,
  source: string,
  target: string,
  sourcePort = "out",
  targetPort = "in"
): Edge {
  return { id, source, sourcePort, target, targetPort }
}

function registerDefinition(
  harness: TestHarness,
  type: string,
  execute: NodeDefinition["execute"],
  executionMode?: NodeDefinition["executionMode"]
) {
  harness.registry.registerNode({
    type,
    category: "basic",
    label: type,
    icon: () => null,
    config: [],
    outputs: [{ id: "out", name: "输出", dataType: "string" }],
    execute,
    executionMode,
  })
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

describe("canvas store history", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"))
    localStorage.clear()
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it("清空画布可以撤销", async () => {
    const { useCanvasStore } = await createTestHarness()
    const original = node("a", "test", { x: 10, y: 20 })

    useCanvasStore.getState().addNode(original)
    useCanvasStore.getState().clearCanvas()

    expect(useCanvasStore.getState().nodes).toEqual([])
    expect(useCanvasStore.getState().canUndo).toBe(true)

    useCanvasStore.getState().undo()

    expect(useCanvasStore.getState().nodes).toEqual([original])
    expect(useCanvasStore.getState().edges).toEqual([])
  })

  it("节点移动可以撤销到拖动前的位置", async () => {
    const { useCanvasStore } = await createTestHarness()
    const originalPosition = { x: 10, y: 20 }

    useCanvasStore.getState().addNode(node("a", "test", originalPosition))
    const nodesBeforeMove = useCanvasStore.getState().nodes
    useCanvasStore.getState().updateNodePosition("a", { x: 200, y: 300 })

    expect(useCanvasStore.getState().nodes[0].position).toEqual({ x: 200, y: 300 })
    expect(nodesBeforeMove[0].position).toEqual(originalPosition)
    expect(useCanvasStore.getState().nodes).not.toBe(nodesBeforeMove)

    useCanvasStore.getState().undo()

    expect(useCanvasStore.getState().nodes[0].position).toEqual(originalPosition)
  })

  it("新增节点会立即选中，方便直接编辑", async () => {
    const { useCanvasStore } = await createTestHarness()

    useCanvasStore.getState().addNode(node("new-node"))

    expect(useCanvasStore.getState().selectedNodeId).toBe("new-node")
    expect(useCanvasStore.getState().selectedNodeIds).toEqual(["new-node"])
  })

  it("多选使用统一状态，并关闭单节点主选择", async () => {
    const { useCanvasStore } = await createTestHarness()
    useCanvasStore.getState().addSubgraph({
      nodes: [node("a"), node("b")],
      edges: [],
    })

    useCanvasStore.getState().selectNodes(["a", "b"])
    expect(useCanvasStore.getState()).toMatchObject({
      selectedNodeIds: ["a", "b"],
      selectedNodeId: null,
    })

    useCanvasStore.getState().selectNode("a")
    expect(useCanvasStore.getState()).toMatchObject({
      selectedNodeIds: ["a"],
      selectedNodeId: "a",
    })
  })

  it("批量添加子图只产生一条撤销记录", async () => {
    const { useCanvasStore } = await createTestHarness()
    const addedNodes = [node("a"), node("b")]
    const addedEdge = edge("a-b", "a", "b")

    useCanvasStore.getState().addSubgraph({ nodes: addedNodes, edges: [addedEdge] })
    expect(useCanvasStore.getState()).toMatchObject({
      nodes: addedNodes,
      edges: [addedEdge],
      selectedNodeId: "b",
    })

    useCanvasStore.getState().undo()
    expect(useCanvasStore.getState().nodes).toEqual([])
    expect(useCanvasStore.getState().edges).toEqual([])
  })

  it("批量添加和单条添加都会拒绝重复的边 ID", async () => {
    const { useCanvasStore } = await createTestHarness()
    useCanvasStore.getState().addSubgraph({
      nodes: [node("a"), node("b")],
      edges: [edge("shared-id", "a", "b")],
    })
    useCanvasStore.getState().addSubgraph({
      nodes: [node("c"), node("d")],
      edges: [edge("shared-id", "c", "d")],
    })
    useCanvasStore.getState().addEdge(edge("shared-id", "a", "d", "other-out"))

    expect(useCanvasStore.getState().edges).toEqual([
      edge("shared-id", "a", "b"),
    ])
  })

  it("批量移动节点可以一次撤销", async () => {
    const { useCanvasStore } = await createTestHarness()
    useCanvasStore.getState().addSubgraph({
      nodes: [node("a"), node("b", "test", { x: 20, y: 30 })],
      edges: [],
    })

    useCanvasStore.getState().updateNodePositions([
      { id: "a", position: { x: 100, y: 120 } },
      { id: "b", position: { x: 240, y: 260 } },
    ])
    expect(useCanvasStore.getState().nodes.map((item) => item.position)).toEqual([
      { x: 100, y: 120 },
      { x: 240, y: 260 },
    ])

    useCanvasStore.getState().undo()
    expect(useCanvasStore.getState().nodes.map((item) => item.position)).toEqual([
      { x: 0, y: 0 },
      { x: 20, y: 30 },
    ])
  })

  it("撤销和重做纯位置变化会保留执行结果", async () => {
    const { useCanvasStore } = await createTestHarness()
    useCanvasStore.getState().addNode(node("a", "test", { x: 10, y: 20 }))
    useCanvasStore.setState({
      nodeOutputs: { a: { out: "result" } },
      nodeErrors: { a: "kept for visual history" },
    })

    useCanvasStore.getState().updateNodePosition("a", { x: 200, y: 300 })
    useCanvasStore.getState().undo()
    expect(useCanvasStore.getState()).toMatchObject({
      nodeOutputs: { a: { out: "result" } },
      nodeErrors: { a: "kept for visual history" },
    })

    useCanvasStore.getState().redo()
    expect(useCanvasStore.getState()).toMatchObject({
      nodeOutputs: { a: { out: "result" } },
      nodeErrors: { a: "kept for visual history" },
    })
  })

  it("批量删除节点及内部连线可以一次撤销", async () => {
    const { useCanvasStore } = await createTestHarness()
    const originalNodes = [node("a"), node("b"), node("c")]
    const originalEdges = [edge("a-b", "a", "b"), edge("b-c", "b", "c")]
    useCanvasStore.getState().addSubgraph({ nodes: originalNodes, edges: originalEdges })

    useCanvasStore.getState().removeNodes(["a", "b"])
    expect(useCanvasStore.getState().nodes).toEqual([node("c")])
    expect(useCanvasStore.getState().edges).toEqual([])

    useCanvasStore.getState().undo()
    expect(useCanvasStore.getState().nodes).toEqual(originalNodes)
    expect(useCanvasStore.getState().edges).toEqual(originalEdges)
  })

  it("短时间内同一节点的连续配置编辑合并成一条历史", async () => {
    const { useCanvasStore } = await createTestHarness()

    useCanvasStore.getState().addNode(node("a"))
    useCanvasStore.getState().updateNodeConfig("a", { value: "h" })
    vi.advanceTimersByTime(100)
    useCanvasStore.getState().updateNodeConfig("a", { value: "hello" })

    expect(useCanvasStore.getState().nodes[0].config).toEqual({ value: "hello" })

    useCanvasStore.getState().undo()

    expect(useCanvasStore.getState().nodes[0].config).toEqual({})

    // 第二次撤销应直接回到添加节点前，证明两次编辑没有各占一条历史。
    useCanvasStore.getState().undo()
    expect(useCanvasStore.getState().nodes).toEqual([])
  })

  it("同一输入端口的新连线会原子替换旧连线，并可一次撤销", async () => {
    const { useCanvasStore } = await createTestHarness()
    const original = edge("a-c", "a", "c")
    const replacement = edge("b-c", "b", "c")
    useCanvasStore.setState({
      nodes: [node("a"), node("b"), node("c")],
      edges: [original],
    })

    useCanvasStore.getState().addEdge(replacement)
    expect(useCanvasStore.getState().edges).toEqual([replacement])

    useCanvasStore.getState().undo()
    expect(useCanvasStore.getState().edges).toEqual([original])
  })

  it("store 层拒绝会形成环路的连线", async () => {
    const { useCanvasStore } = await createTestHarness()
    const existing = [edge("a-b", "a", "b"), edge("b-c", "b", "c")]
    useCanvasStore.setState({
      nodes: [node("a"), node("b"), node("c")],
      edges: existing,
    })

    useCanvasStore.getState().addEdge(edge("c-a", "c", "a"))

    expect(useCanvasStore.getState().edges).toEqual(existing)
  })
})

describe("canvas store execution", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"))
    localStorage.clear()
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it("关闭自动运行后配置编辑不会触发执行", async () => {
    const harness = await createTestHarness()
    const execute = vi.fn(async () => ({ out: "result" }))
    registerDefinition(harness, "test", execute)

    harness.useCanvasStore.getState().addNode(node("a"))
    harness.useCanvasStore.getState().updateNodeConfig("a", { value: "changed" })
    await vi.advanceTimersByTimeAsync(1_000)

    expect(execute).not.toHaveBeenCalled()
  })

  it("关闭自动运行会阻止已经排队但尚未开始的自动任务", async () => {
    const harness = await createTestHarness()
    const executeSource = vi.fn(async () => ({ out: "source" }))
    const executeTarget = vi.fn(async () => ({ out: "target" }))
    registerDefinition(harness, "source", executeSource)
    registerDefinition(harness, "target", executeTarget)
    harness.useCanvasStore.setState({
      nodes: [node("a", "source"), node("b", "target")],
      edges: [],
    })

    harness.useCanvasStore.getState().setAutoRun(true)
    harness.useCanvasStore.getState().addEdge(edge("a-b", "a", "b"))
    harness.useCanvasStore.getState().setAutoRun(false)
    await vi.runAllTimersAsync()

    expect(executeTarget).not.toHaveBeenCalled()
  })

  it("自动执行路径跳过 manual 节点，显式执行仍可运行", async () => {
    const harness = await createTestHarness()
    const execute = vi.fn(async () => ({ out: "requested" }))
    registerDefinition(harness, "manual", execute, "manual")

    harness.useCanvasStore.getState().addNode(node("request", "manual"))
    harness.useCanvasStore.getState().setAutoRun(true)
    harness.useCanvasStore.getState().updateNodeConfig("request", { url: "/api" })
    await vi.advanceTimersByTimeAsync(1_000)

    expect(execute).not.toHaveBeenCalled()

    await harness.useCanvasStore.getState().executeNode("request")
    expect(execute).toHaveBeenCalledTimes(1)

    execute.mockClear()
    await harness.useCanvasStore.getState().executeAll()
    expect(execute).toHaveBeenCalledTimes(1)
  })

  it("自动运行对连续配置编辑防抖，并只执行最后一次配置", async () => {
    const harness = await createTestHarness()
    const execute = vi.fn(async (_inputs, config) => ({ out: config.value }))
    registerDefinition(harness, "test", execute)

    harness.useCanvasStore.getState().addNode(node("a"))
    harness.useCanvasStore.getState().setAutoRun(true)
    harness.useCanvasStore.getState().updateNodeConfig("a", { value: "first" })
    await vi.advanceTimersByTimeAsync(200)
    harness.useCanvasStore.getState().updateNodeConfig("a", { value: "latest" })

    await vi.advanceTimersByTimeAsync(349)
    expect(execute).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(execute).toHaveBeenCalledTimes(1)
    expect(execute).toHaveBeenCalledWith({}, { value: "latest" })
  })

  it("executeAll 在汇合节点执行前等待所有上游，且只执行一次", async () => {
    const harness = await createTestHarness()
    const executionOrder: string[] = []
    const executeA = vi.fn(async () => {
      executionOrder.push("a")
      return { out: "A" }
    })
    const executeB = vi.fn(async () => {
      executionOrder.push("b")
      return { out: "B" }
    })
    const executeMerge = vi.fn(async (inputs) => {
      executionOrder.push("merge")
      return { out: `${inputs.left}${inputs.right}` }
    })

    registerDefinition(harness, "source-a", executeA)
    registerDefinition(harness, "source-b", executeB)
    registerDefinition(harness, "merge", executeMerge)

    harness.useCanvasStore.setState({
      nodes: [
        node("a", "source-a"),
        node("b", "source-b"),
        node("c", "merge"),
      ],
      edges: [
        edge("a-c", "a", "c", "out", "left"),
        edge("b-c", "b", "c", "out", "right"),
      ],
      nodeOutputs: {},
      nodeErrors: {},
      nodeRunning: {},
    })

    await harness.useCanvasStore.getState().executeAll()

    expect(executionOrder).toEqual(["a", "b", "merge"])
    expect(executeMerge).toHaveBeenCalledTimes(1)
    expect(executeMerge).toHaveBeenCalledWith(
      { left: "A", right: "B" },
      {}
    )
    expect(harness.useCanvasStore.getState().nodeOutputs.c).toEqual({ out: "AB" })
  })

  it("hasOutput 配置端口输出有效配置值，并保留上游输入覆盖", async () => {
    const harness = await createTestHarness()
    registerDefinition(harness, "source", async () => ({ out: "upstream" }))
    harness.registry.registerNode({
      type: "relay",
      category: "basic",
      label: "relay",
      icon: () => null,
      config: [
        {
          id: "setting",
          name: "Setting",
          dataType: "string",
          defaultValue: "fallback",
          hasInput: true,
          hasOutput: true,
        },
      ],
      outputs: [{ id: "out", name: "Output", dataType: "string" }],
      execute: async (inputs, config) => ({
        out: inputs.setting ?? config.setting ?? "fallback",
      }),
    })
    registerDefinition(harness, "sink", async (inputs) => ({ out: inputs.in }))

    harness.useCanvasStore.setState({
      nodes: [
        node("a", "source"),
        node("b", "relay", { x: 0, y: 0 }, { setting: "configured" }),
        node("c", "sink"),
      ],
      edges: [
        edge("a-b", "a", "b", "out", "setting"),
        edge("b-c", "b", "c", "setting", "in"),
      ],
      nodeOutputs: {},
      nodeErrors: {},
      nodeRunning: {},
    })

    await harness.useCanvasStore.getState().executeAll()

    expect(harness.useCanvasStore.getState().nodeOutputs.b).toEqual({
      setting: "upstream",
      out: "upstream",
    })
    expect(harness.useCanvasStore.getState().nodeOutputs.c).toEqual({
      out: "upstream",
    })
  })

  it("executeNode 按可达子图拓扑执行，菱形汇合只运行一次", async () => {
    const harness = await createTestHarness()
    const executeRoot = vi.fn(async () => ({ out: "root" }))
    const executeLeft = vi.fn(async (inputs) => ({ out: `${inputs.in}-left` }))
    const executeRight = vi.fn(async (inputs) => ({ out: `${inputs.in}-right` }))
    const executeMerge = vi.fn(async (inputs) => ({
      out: `${inputs.left}|${inputs.right}`,
    }))

    registerDefinition(harness, "root", executeRoot)
    registerDefinition(harness, "left", executeLeft)
    registerDefinition(harness, "right", executeRight)
    registerDefinition(harness, "merge", executeMerge)

    harness.useCanvasStore.setState({
      nodes: [
        node("a", "root"),
        node("b", "left"),
        node("c", "right"),
        node("d", "merge"),
      ],
      edges: [
        edge("a-b", "a", "b"),
        edge("a-c", "a", "c"),
        edge("b-d", "b", "d", "out", "left"),
        edge("c-d", "c", "d", "out", "right"),
      ],
      nodeOutputs: {},
      nodeErrors: {},
      nodeRunning: {},
    })

    await harness.useCanvasStore.getState().executeNode("a")

    expect(executeMerge).toHaveBeenCalledTimes(1)
    expect(executeMerge).toHaveBeenCalledWith(
      { left: "root-left", right: "root-right" },
      {}
    )
    expect(harness.useCanvasStore.getState().nodeOutputs.d).toEqual({
      out: "root-left|root-right",
    })
  })

  it("工作流替换后旧异步任务不能覆盖新任务结果", async () => {
    const harness = await createTestHarness()
    const firstRun = deferred<Record<string, unknown>>()
    const secondRun = deferred<Record<string, unknown>>()
    const execute = vi
      .fn<NodeDefinition["execute"]>()
      .mockImplementationOnce(() => firstRun.promise)
      .mockImplementationOnce(() => secondRun.promise)
    registerDefinition(harness, "slow", execute)

    harness.useCanvasStore.setState({ nodes: [node("a", "slow")], edges: [] })
    const staleExecution = harness.useCanvasStore
      .getState()
      .executeNode("a", undefined, false)
    await Promise.resolve()

    harness.useCanvasStore.getState().replaceWorkflow({
      nodes: [node("a", "slow", { x: 0, y: 0 }, { revision: 2 })],
      edges: [],
    })
    const currentExecution = harness.useCanvasStore
      .getState()
      .executeNode("a", undefined, false)
    await Promise.resolve()

    secondRun.resolve({ out: "new" })
    await currentExecution
    expect(harness.useCanvasStore.getState().nodeOutputs.a).toEqual({ out: "new" })

    firstRun.resolve({ out: "stale" })
    await staleExecution
    expect(harness.useCanvasStore.getState().nodeOutputs.a).toEqual({ out: "new" })
    expect(
      harness.useCanvasStore.getState().executionLog.map((entry) => entry.status)
    ).toEqual(["cancelled", "success"])
  })

  it("工作流替换会终止旧 executeAll 计划，不会驱动新图中的同名节点", async () => {
    const harness = await createTestHarness()
    const slowRun = deferred<Record<string, unknown>>()
    const executeOldSource = vi.fn(() => slowRun.promise)
    const executeOldTarget = vi.fn(async () => ({ out: "old target" }))
    const executeNewTarget = vi.fn(async () => ({ out: "new target" }))
    registerDefinition(harness, "old-source", executeOldSource)
    registerDefinition(harness, "old-target", executeOldTarget)
    registerDefinition(harness, "new-target", executeNewTarget)

    harness.useCanvasStore.setState({
      nodes: [node("a", "old-source"), node("b", "old-target")],
      edges: [edge("a-b", "a", "b")],
      nodeOutputs: {},
      nodeErrors: {},
      nodeRunning: {},
    })
    const stalePlan = harness.useCanvasStore.getState().executeAll()
    await Promise.resolve()

    harness.useCanvasStore.getState().replaceWorkflow({
      nodes: [node("b", "new-target")],
      edges: [],
    })
    slowRun.resolve({ out: "old source" })
    await stalePlan

    expect(executeOldTarget).not.toHaveBeenCalled()
    expect(executeNewTarget).not.toHaveBeenCalled()
    expect(harness.useCanvasStore.getState().nodeOutputs).toEqual({})
  })

  it("从本地存储载入工作流会清除上一张图的运行态和旧结果", async () => {
    const harness = await createTestHarness()
    harness.useCanvasStore.setState({
      nodes: [node("old")],
      edges: [],
      nodeOutputs: { old: { out: "stale" } },
      nodeErrors: { old: "old error" },
      nodeRunning: { old: true },
      selectedNodeId: "old",
    })
    harness.useCanvasStore.getState().pushHistory()
    localStorage.setItem(
      "canvas-state",
      JSON.stringify({
        nodes: [{ id: "new", type: "test", position: { x: 0, y: 0 } }],
        edges: [],
      })
    )

    harness.useCanvasStore.getState().loadFromLocalStorage()

    expect(harness.useCanvasStore.getState()).toMatchObject({
      nodes: [node("new")],
      edges: [],
      nodeOutputs: {},
      nodeErrors: {},
      nodeRunning: {},
      selectedNodeId: null,
      selectedNodeIds: [],
      canUndo: false,
      canRedo: false,
    })
  })

  it("执行失败会清除旧输出，下游不会收到陈旧输入", async () => {
    const harness = await createTestHarness()
    const executeFailing = vi.fn(async () => {
      throw new Error("failed")
    })
    const executeDownstream = vi.fn(async (inputs) => ({ out: inputs.in ?? "empty" }))
    registerDefinition(harness, "failing", executeFailing)
    registerDefinition(harness, "downstream", executeDownstream)

    harness.useCanvasStore.setState({
      nodes: [node("a", "failing"), node("b", "downstream")],
      edges: [edge("a-b", "a", "b")],
      nodeOutputs: { a: { out: "stale" }, b: { out: "old-downstream" } },
      nodeErrors: {},
      nodeRunning: {},
    })

    await harness.useCanvasStore.getState().executeAll()

    expect(harness.useCanvasStore.getState().nodeOutputs.a).toBeUndefined()
    expect(harness.useCanvasStore.getState().nodeErrors.a).toBe("failed")
    expect(executeDownstream).toHaveBeenCalledWith({}, {})
    expect(harness.useCanvasStore.getState().nodeOutputs.b).toEqual({ out: "empty" })
  })

  it("执行日志从 running 原地更新为 success，并记录耗时", async () => {
    const harness = await createTestHarness()
    const run = deferred<Record<string, unknown>>()
    registerDefinition(harness, "timed", () => run.promise)
    harness.useCanvasStore.setState({ nodes: [node("a", "timed")], edges: [] })

    const execution = harness.useCanvasStore
      .getState()
      .executeNode("a", undefined, false)
    const runningEntry = harness.useCanvasStore.getState().executionLog[0]

    expect(runningEntry).toMatchObject({
      nodeId: "a",
      nodeType: "timed",
      status: "running",
      startedAt: Date.now(),
      durationMs: 0,
    })

    vi.advanceTimersByTime(125)
    run.resolve({ out: "done" })
    await execution

    expect(harness.useCanvasStore.getState().executionLog).toHaveLength(1)
    expect(harness.useCanvasStore.getState().executionLog[0]).toEqual({
      ...runningEntry,
      status: "success",
      durationMs: 125,
    })
  })

  it("执行失败会将同一日志条目标记为 error 并记录错误信息", async () => {
    const harness = await createTestHarness()
    const run = deferred<Record<string, unknown>>()
    registerDefinition(harness, "failing-log", () => run.promise)
    harness.useCanvasStore.setState({
      nodes: [node("a", "failing-log")],
      edges: [],
    })

    const execution = harness.useCanvasStore
      .getState()
      .executeNode("a", undefined, false)
    const entryId = harness.useCanvasStore.getState().executionLog[0].id
    vi.advanceTimersByTime(40)
    run.reject(new Error("network failed"))
    await execution

    expect(harness.useCanvasStore.getState().executionLog).toEqual([
      {
        id: entryId,
        nodeId: "a",
        nodeType: "failing-log",
        status: "error",
        startedAt: Date.now() - 40,
        durationMs: 40,
        error: "network failed",
      },
    ])
  })

  it("替换工作流和清空画布会立即取消 running 日志", async () => {
    const harness = await createTestHarness()
    const firstRun = deferred<Record<string, unknown>>()
    const secondRun = deferred<Record<string, unknown>>()
    const execute = vi
      .fn<NodeDefinition["execute"]>()
      .mockImplementationOnce(() => firstRun.promise)
      .mockImplementationOnce(() => secondRun.promise)
    registerDefinition(harness, "slow-log", execute)
    harness.useCanvasStore.setState({
      nodes: [node("a", "slow-log")],
      edges: [],
    })

    const firstExecution = harness.useCanvasStore
      .getState()
      .executeNode("a", undefined, false)
    vi.advanceTimersByTime(10)
    harness.useCanvasStore.getState().replaceWorkflow({
      nodes: [node("b", "slow-log")],
      edges: [],
    })
    expect(harness.useCanvasStore.getState().executionLog[0]).toMatchObject({
      status: "cancelled",
      durationMs: 10,
    })

    const secondExecution = harness.useCanvasStore
      .getState()
      .executeNode("b", undefined, false)
    vi.advanceTimersByTime(15)
    harness.useCanvasStore.getState().clearCanvas()

    expect(
      harness.useCanvasStore.getState().executionLog.some(
        (entry) => entry.status === "running"
      )
    ).toBe(false)
    expect(harness.useCanvasStore.getState().executionLog.at(-1)).toMatchObject({
      nodeId: "b",
      status: "cancelled",
      durationMs: 15,
    })

    firstRun.resolve({ out: "stale-a" })
    secondRun.resolve({ out: "stale-b" })
    await Promise.all([firstExecution, secondExecution])
    expect(
      harness.useCanvasStore.getState().executionLog.every(
        (entry) => entry.status === "cancelled"
      )
    ).toBe(true)
  })

  it("执行日志只保留最近 100 条，并支持清空", async () => {
    const harness = await createTestHarness()
    registerDefinition(harness, "fast", async () => ({ out: "ok" }))
    harness.useCanvasStore.setState({ nodes: [node("a", "fast")], edges: [] })

    for (let index = 0; index < 105; index += 1) {
      await harness.useCanvasStore.getState().executeNode("a", undefined, false)
    }

    const log = harness.useCanvasStore.getState().executionLog
    expect(log).toHaveLength(100)
    expect(log.every((entry) => entry.status === "success")).toBe(true)
    expect(log[0].id).toBe(log.at(-1)!.id - 99)

    harness.useCanvasStore.getState().clearExecutionLog()
    expect(harness.useCanvasStore.getState().executionLog).toEqual([])
  })
})
