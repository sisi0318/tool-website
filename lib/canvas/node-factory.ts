import { getNodeDefinition } from "./registry"
import type { NodeInstance } from "./types"

let fallbackSequence = 0

export function createCanvasNodeId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `node-${crypto.randomUUID()}`
  }

  fallbackSequence += 1
  return `node-${Date.now()}-${fallbackSequence}`
}

/**
 * 新建节点时把声明的 defaultValue 落进 config。
 *
 * 之前 config 恒为 `{}`，导致依赖配置取值的 `visible()` 谓词失效：
 * 例如古典密码的 algorithm 默认是 caesar，但新建的节点上 `config.algorithm`
 * 是 undefined，于是 Shift 参数（`visible: config.algorithm === "caesar"`）
 * 根本不显示，用户必须先动一下算法下拉框才能看到它。
 * 同时也让"从未编辑过"和"编辑回默认值"这两种状态一致。
 */
export function createCanvasNode(
  type: string,
  position: NodeInstance["position"]
): NodeInstance {
  return {
    id: createCanvasNodeId(),
    type,
    position,
    config: withDefaultConfig(type, {}),
  }
}

/** 补齐声明了 defaultValue 但配置里缺失的字段。已有取值不会被覆盖。 */
export function withDefaultConfig(
  type: string,
  config: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const definition = getNodeDefinition(type)
  if (!definition) return { ...config }

  const merged: Record<string, unknown> = {}
  for (const field of definition.config) {
    if (field.defaultValue !== undefined) merged[field.id] = field.defaultValue
  }
  return { ...merged, ...config }
}
