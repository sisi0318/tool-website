import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { NodeDefinition } from "./types"

async function harness() {
  const { registerNode } = await import("./registry")
  const { useCanvasStore, stopPendingCanvasWork, UPSTREAM_ERROR, UPSTREAM_PENDING } = await import("./store")
  const register = (type: string, execute: NodeDefinition["execute"], manual = false) => registerNode({
    type, label: type, category: "dev", icon: (() => null) as never, config: [],
    outputs: [{ id: "out", name: "Out", dataType: "string" }], execute,
    ...(manual ? { executionMode: "manual" as const, network: true } : {}),
  })
  return { store: useCanvasStore, stopPendingCanvasWork, UPSTREAM_ERROR, UPSTREAM_PENDING, register }
}
const node = (id: string, type = id) => ({ id, type, position: { x: 0, y: 0 }, config: {} })
const edge = (source: string, target: string) => ({ id: `${source}-${target}`, source, target, sourcePort: "out", targetPort: "in" })

beforeEach(() => { vi.resetModules(); vi.useFakeTimers(); localStorage.clear() })
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers() })

describe("execution safety across lifecycle and entry points", () => {
  it("unmount aborts an in-flight manual request without retrying it", async () => {
    const { store, register, stopPendingCanvasWork } = await harness()
    let signal: AbortSignal | undefined
    const request = vi.fn<NodeDefinition["execute"]>(async (_inputs, _config, context) => {
      signal = context?.signal
      return new Promise(() => {})
    })
    register("post", request, true)
    store.setState({ nodes: [node("post")], edges: [], autoRun: true })
    const run = store.getState().executeAll()
    await Promise.resolve()
    stopPendingCanvasWork()
    await run
    expect(signal?.aborted).toBe(true)
    expect(request).toHaveBeenCalledTimes(1)
    expect(store.getState().nodeOutputs).toEqual({})
    expect(store.getState().executionLog.map(entry => entry.status)).toEqual(["cancelled"])
  })

  it("unmount cancels the zero-delay graph load task as well as node debounces", async () => {
    const { store, register, stopPendingCanvasWork } = await harness()
    const execute = vi.fn(async () => ({ out: "unexpected" }))
    register("queued", execute)
    store.getState().replaceWorkflow({ nodes: [node("queued")], edges: [] })
    stopPendingCanvasWork()
    await vi.advanceTimersByTimeAsync(1000)
    expect(execute).not.toHaveBeenCalled()
  })

  it("stopping a wave does not start requests that were waiting for a concurrency slot", async () => {
    const { store, register, stopPendingCanvasWork } = await harness()
    const request = vi.fn<NodeDefinition["execute"]>(async () => new Promise(() => {}))
    register("post", request, true)
    store.setState({ nodes: Array.from({ length: 8 }, (_, index) => node(`post-${index}`, "post")), edges: [], autoRun: true })
    const run = store.getState().executeAll()
    await Promise.resolve()
    expect(request).toHaveBeenCalledTimes(4)
    stopPendingCanvasWork()
    await run
    expect(request).toHaveBeenCalledTimes(4)
  })

  it("graph convergence never repeats a manual request or authorizes newly added ones", async () => {
    const { store, register } = await harness()
    let release!: (value: Record<string, unknown>) => void
    const request = vi.fn(() => new Promise<Record<string, unknown>>(resolve => { release = resolve }))
    const addedRequest = vi.fn(async () => ({ out: "unauthorized" }))
    const calculation = vi.fn(async () => ({ out: "calculated" }))
    register("post", request, true); register("new-post", addedRequest, true); register("calculate", calculation)
    store.setState({ nodes: [node("post")], edges: [], autoRun: true })
    const run = store.getState().executeAll()
    await Promise.resolve()
    store.getState().addNode(node("calculate"))
    store.getState().addNode(node("new-post"))
    release({ out: "accepted" })
    await run
    expect(request).toHaveBeenCalledTimes(1)
    expect(addedRequest).not.toHaveBeenCalled()
    expect(calculation).toHaveBeenCalledTimes(1)
    // A subsequent explicit run remains a new authorization.
    request.mockResolvedValue({ out: "accepted-again" })
    await store.getState().executeAll()
    expect(request).toHaveBeenCalledTimes(2)
    expect(addedRequest).toHaveBeenCalledTimes(1)
  })

  it("automatic cascades clear stale descendants and stop at upstream errors", async () => {
    const { store, register, UPSTREAM_ERROR } = await harness()
    register("parse", async () => { throw new Error("Invalid JSON") })
    const hash = vi.fn(async () => ({ out: "empty-hash" }))
    const sink = vi.fn(async () => ({ out: "wrong" }))
    register("hash", hash); register("sink", sink)
    store.setState({ nodes: [node("parse"), node("hash"), node("sink")], edges: [edge("parse", "hash"), edge("hash", "sink")], autoRun: true, nodeOutputs: { hash: { out: "stale" }, sink: { out: "stale" } } })
    store.getState().updateNodeConfig("parse", { value: "{bad" })
    await vi.advanceTimersByTimeAsync(351)
    expect(hash).not.toHaveBeenCalled(); expect(sink).not.toHaveBeenCalled()
    expect(store.getState().nodeOutputs).toEqual({})
    expect(store.getState().nodeErrors).toMatchObject({ parse: "Invalid JSON", hash: UPSTREAM_ERROR, sink: UPSTREAM_ERROR })
  })

  it("single-step execution blocks failed dependencies and recovers after a successful rerun", async () => {
    const { store, register, UPSTREAM_ERROR } = await harness()
    const parse = vi.fn<NodeDefinition["execute"]>().mockRejectedValueOnce(new Error("Invalid JSON")).mockResolvedValue({ out: "valid" })
    const hash = vi.fn(async (inputs: Record<string, unknown>) => ({ out: inputs.in }))
    register("parse", parse); register("hash", hash)
    store.setState({ nodes: [node("parse"), node("hash")], edges: [edge("parse", "hash")], autoRun: false })
    await store.getState().executeStep(); await store.getState().executeStep()
    expect(hash).not.toHaveBeenCalled()
    expect(store.getState().nodeErrors.hash).toBe(UPSTREAM_ERROR)
    await store.getState().executeStep(); await store.getState().executeStep()
    expect(hash).toHaveBeenCalledTimes(1)
    expect(store.getState().nodeOutputs.hash).toEqual({ out: "valid" })
    expect(store.getState().nodeErrors.hash).toBeUndefined()
  })

  it("a node wired to an upstream that never ran waits instead of computing its defaults", async () => {
    const { store, register, UPSTREAM_PENDING } = await harness()
    const hash = vi.fn(async (inputs: Record<string, unknown>) => ({ out: `hash:${String(inputs.in ?? "")}` }))
    register("generator", async () => ({ out: "pw" })); register("hash", hash)
    store.setState({ nodes: [node("generator"), node("hash")], edges: [edge("generator", "hash")], autoRun: false, nodeOutputs: { hash: { out: "stale" } } })
    await store.getState().executeNode("hash", undefined, false, false)
    expect(hash).not.toHaveBeenCalled()
    expect(store.getState().nodeErrors.hash).toBe(UPSTREAM_PENDING)
    expect(store.getState().nodeOutputs.hash).toBeUndefined()
    expect(store.getState().executionLog.at(-1)).toMatchObject({ nodeId: "hash", status: "skipped", error: UPSTREAM_PENDING })
  })

  it("connecting a freshly added upstream runs it before the downstream", async () => {
    const { store, register } = await harness()
    const generator = vi.fn(async () => ({ out: "pw" }))
    const hash = vi.fn(async (inputs: Record<string, unknown>) => ({ out: `hash:${String(inputs.in)}` }))
    register("generator", generator); register("hash", hash)
    store.setState({ nodes: [node("generator"), node("hash")], edges: [], autoRun: true })
    store.getState().addEdge(edge("generator", "hash"))
    await vi.advanceTimersByTimeAsync(10)
    expect(generator).toHaveBeenCalledTimes(1)
    expect(hash).toHaveBeenCalledTimes(1)
    expect(store.getState().nodeOutputs.hash).toEqual({ out: "hash:pw" })
    expect(store.getState().nodeErrors).toEqual({ generator: undefined, hash: undefined })
  })

  it("an unclicked manual upstream leaves the node waiting rather than failed", async () => {
    const { store, register, UPSTREAM_PENDING } = await harness()
    const request = vi.fn(async () => ({ out: "response" }))
    const sink = vi.fn(async () => ({ out: "wrong" }))
    register("post", request, true); register("sink", sink)
    store.setState({ nodes: [node("post"), node("sink")], edges: [edge("post", "sink")], autoRun: true })
    await store.getState().executeToNode("sink", true)
    expect(request).not.toHaveBeenCalled()
    expect(sink).not.toHaveBeenCalled()
    expect(store.getState().nodeErrors.sink).toBe(UPSTREAM_PENDING)
  })

  it("running a node below a finished manual request reuses its result instead of skipping the chain", async () => {
    const { store, register } = await harness()
    const request = vi.fn(async () => ({ out: "fresh request" }))
    const middle = vi.fn(async (inputs: Record<string, unknown>) => ({ out: `m:${String(inputs.in)}` }))
    const sink = vi.fn(async (inputs: Record<string, unknown>) => ({ out: `s:${String(inputs.in)}` }))
    register("post", request, true); register("middle", middle); register("sink", sink)
    store.setState({ nodes: [node("post"), node("middle"), node("sink")], edges: [edge("post", "middle"), edge("middle", "sink")], autoRun: false, nodeOutputs: { post: { out: "response" }, middle: { out: "m:stale" } } })
    await store.getState().executeToNode("sink", true)
    // 不替用户重发请求，但中间节点按现有结果重算；以前中间节点被跳过，末端拿到的是 m:stale
    expect(request).not.toHaveBeenCalled()
    expect(middle).toHaveBeenCalledTimes(1)
    expect(store.getState().nodeOutputs.sink).toEqual({ out: "s:m:response" })
  })

  it("refreshes what is downstream of a manual request once it runs, when auto-run is on", async () => {
    const { store, register } = await harness()
    const request = vi.fn(async () => ({ out: "response" }))
    const after = vi.fn(async (inputs: Record<string, unknown>) => ({ out: `after:${String(inputs.in)}` }))
    register("post", request, true); register("after", after)
    store.setState({ nodes: [node("post"), node("after")], edges: [edge("post", "after")], autoRun: true })
    await store.getState().executeToNode("post", true)
    expect(request).toHaveBeenCalledTimes(1)
    expect(store.getState().nodeOutputs.after).toEqual({ out: "after:response" })

    after.mockClear()
    store.setState({ autoRun: false })
    await store.getState().executeToNode("post", true)
    expect(after).not.toHaveBeenCalled()
  })

  it("waiting passes down a cascade as waiting, not as an upstream failure", async () => {
    const { store, register, UPSTREAM_PENDING } = await harness()
    const middle = vi.fn(async () => ({ out: "b" }))
    const last = vi.fn(async () => ({ out: "c" }))
    register("first", async () => ({ out: "a" })); register("middle", middle); register("last", last)
    store.setState({ nodes: [node("first"), node("middle"), node("last")], edges: [edge("first", "middle"), edge("middle", "last")], autoRun: false })
    await store.getState().executeNode("middle", undefined, true, false)
    expect(middle).not.toHaveBeenCalled(); expect(last).not.toHaveBeenCalled()
    expect(store.getState().nodeErrors).toMatchObject({ middle: UPSTREAM_PENDING, last: UPSTREAM_PENDING })
  })
})
