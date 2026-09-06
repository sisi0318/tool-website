import type { ConfigField, DerivedOutput, NodeDefinition } from "../canvas/types"
import { getNodeDefinition } from "../canvas/registry"
import { withDefaultConfig } from "../canvas/node-factory"
import { convertPortValue } from "../canvas/convert-value"
import { getExecutionTimeout } from "../canvas/engine"
import { getChildren, inferDataType } from "./tree"
import type {
  ApplyStepResult,
  Journey,
  JourneyNode,
  JourneyStep,
  ReplayDescendantsResult,
  ReplayResult,
  ReplayStepOutcome,
} from "./types"

const STEP_TIMEOUT_MS = 30_000

function withTimeout<T>(promise: Promise<T>, ms = STEP_TIMEOUT_MS, onTimeout?: () => void, signal?: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let done = false
    const cleanup = () => { clearTimeout(timer); signal?.removeEventListener("abort", abort) }
    const abort = () => { if (done) return; done = true; cleanup(); reject(new DOMException("Operation cancelled", "AbortError")) }
    const timer = setTimeout(() => {
      if (done) return
      done = true; cleanup()
      reject(new Error(`Step timed out after ${Math.round(ms / 1000)}s`))
      onTimeout?.()
    }, ms)
    promise.then(
      (value) => {
        if (done) return
        done = true; cleanup()
        resolve(value)
      },
      (error) => {
        if (done) return
        done = true; cleanup()
        reject(error)
      },
    )
    signal?.addEventListener("abort", abort, { once: true })
    if (signal?.aborted) abort()
  })
}

/** 约定:主输入端口 = 第一个 hasInput 的 config 字段 */
export function getMainInputPort(definition: NodeDefinition): ConfigField | null {
  return definition.config.find((field) => field.hasInput) ?? null
}

/** 可对外传递的输出端口:优先 outputs,回退到 hasOutput 的 config 字段 */
export function getOutputPorts(definition: NodeDefinition): DerivedOutput[] {
  if (definition.outputs.length > 0) return definition.outputs
  return definition.config
    .filter((field) => field.hasOutput)
    .map((field) => ({ id: field.id, name: field.name, dataType: field.dataType }))
}

export function resolveOutputPort(definition: NodeDefinition, preferred?: string): string {
  const ports = getOutputPorts(definition)
  if (preferred && ports.some((port) => port.id === preferred)) return preferred
  return ports[0]?.id ?? ""
}

/** 对单个值应用一次变换 */
export async function applyStep(value: unknown, step: JourneyStep, context: { signal?: AbortSignal } = {}): Promise<ApplyStepResult> {
  if (context.signal?.aborted) throw new DOMException("Operation cancelled", "AbortError")
  const definition = getNodeDefinition(step.tool)
  if (!definition) throw new Error(`Unknown tool: ${step.tool}`)

  const mainPort = getMainInputPort(definition)
  if (!mainPort) throw new Error(`Tool has no input port: ${step.tool}`)

  const inputs: Record<string, unknown> = { [mainPort.id]: convertPortValue(value, inferDataType(value), mainPort.dataType) }
  // 分享链接、旧存档和建议创建的步骤都可能只带部分配置,执行前补齐声明的默认值
  const controller = new AbortController()
  const forwardAbort = () => controller.abort()
  context.signal?.addEventListener("abort", forwardAbort, { once: true })
  let outputs: Record<string, unknown>
  try { outputs = await withTimeout(definition.execute(inputs, withDefaultConfig(step.tool, step.config), { signal: controller.signal }), getExecutionTimeout(definition, STEP_TIMEOUT_MS), () => controller.abort(), controller.signal) }
  finally { context.signal?.removeEventListener("abort", forwardAbort) }

  const portId = resolveOutputPort(definition, step.outputPort)
  const nextValue = portId in outputs ? outputs[portId] : outputs[Object.keys(outputs)[0] ?? ""]

  return { outputs, value: nextValue, valueType: inferDataType(nextValue) }
}

/** 对一个根值顺序回放整条路径;失败即止,返回已完成前缀 */
export async function replaySteps(rootValue: unknown, steps: JourneyStep[], context: { signal?: AbortSignal; onStep?: (index: number, total: number, step: JourneyStep) => void } = {}): Promise<ReplayResult> {
  const outcomes: ReplayStepOutcome[] = []
  let current: unknown = rootValue

  for (const step of steps) {
    const startedAt = Date.now()
    try {
      context.onStep?.(outcomes.length, steps.length, step)
      const result = await applyStep(current, step, context)
      current = result.value
      outcomes.push({
        step,
        status: "success",
        value: result.value,
        valueType: result.valueType,
        durationMs: Date.now() - startedAt,
      })
    } catch (error) {
      outcomes.push({
        step,
        status: "error",
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startedAt,
      })
      return {
        outcomes,
        finalValue: current,
        finalValueType: inferDataType(current),
        ok: false,
      }
    }
  }

  return { outcomes, finalValue: current, finalValueType: inferDataType(current), ok: true }
}

/**
 * Recompute every descendant branch from an already-updated parent value.
 * A failed node and its descendants are preserved as topology, but their stale
 * values are cleared and marked missing until that branch can be run again.
 */
export async function replayDescendants(
  journey: Journey,
  parentId: string,
  parentValue: unknown,
): Promise<ReplayDescendantsResult> {
  const nodeUpdates: Record<string, JourneyNode> = {}
  const failures: ReplayDescendantsResult["failures"] = []

  const markSubtreeMissing = (nodeId: string) => {
    const pending = [nodeId]
    const visited = new Set<string>()

    while (pending.length > 0) {
      const currentId = pending.pop()!
      if (visited.has(currentId)) continue
      visited.add(currentId)

      const node = journey.nodes[currentId]
      if (!node) continue
      nodeUpdates[currentId] = { ...node, value: null, valueMissing: true }
      for (const child of getChildren(journey, currentId)) pending.push(child.id)
    }
  }

  const visitChildren = async (currentParentId: string, currentParentValue: unknown): Promise<void> => {
    for (const child of getChildren(journey, currentParentId)) {
      if (!child.via) {
        failures.push({ nodeId: child.id, tool: child.label, error: "Step metadata is missing" })
        markSubtreeMissing(child.id)
        continue
      }

      try {
        const result = await applyStep(currentParentValue, child.via)
        const { valueMissing: _cleared, ...rest } = child
        nodeUpdates[child.id] = {
          ...rest,
          value: result.value,
          valueType: result.valueType,
        }
        await visitChildren(child.id, result.value)
      } catch (error) {
        failures.push({
          nodeId: child.id,
          tool: child.via.tool,
          error: error instanceof Error ? error.message : String(error),
        })
        markSubtreeMissing(child.id)
      }
    }
  }

  await visitChildren(parentId, parentValue)
  return { nodeUpdates, failures, ok: failures.length === 0 }
}
