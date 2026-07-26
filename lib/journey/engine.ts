import type { ConfigField, DerivedOutput, NodeDefinition } from "../canvas/types"
import { getNodeDefinition } from "../canvas/registry"
import { inferDataType } from "./tree"
import type { ApplyStepResult, JourneyStep, ReplayResult, ReplayStepOutcome } from "./types"

const STEP_TIMEOUT_MS = 30_000

function withTimeout<T>(promise: Promise<T>, ms = STEP_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Step timed out after ${Math.round(ms / 1000)}s`))
    }, ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
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
export async function applyStep(value: unknown, step: JourneyStep): Promise<ApplyStepResult> {
  const definition = getNodeDefinition(step.tool)
  if (!definition) throw new Error(`Unknown tool: ${step.tool}`)

  const mainPort = getMainInputPort(definition)
  if (!mainPort) throw new Error(`Tool has no input port: ${step.tool}`)

  const inputs: Record<string, unknown> = { [mainPort.id]: value }
  const outputs = await withTimeout(definition.execute(inputs, step.config))

  const portId = resolveOutputPort(definition, step.outputPort)
  const nextValue = portId in outputs ? outputs[portId] : outputs[Object.keys(outputs)[0] ?? ""]

  return { outputs, value: nextValue, valueType: inferDataType(nextValue) }
}

/** 对一个根值顺序回放整条路径;失败即止,返回已完成前缀 */
export async function replaySteps(rootValue: unknown, steps: JourneyStep[]): Promise<ReplayResult> {
  const outcomes: ReplayStepOutcome[] = []
  let current: unknown = rootValue

  for (const step of steps) {
    const startedAt = Date.now()
    try {
      const result = await applyStep(current, step)
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
