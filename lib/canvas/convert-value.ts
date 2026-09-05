import type { DataType, NodeDefinition } from "./types"

/**
 * 端口之间的值转换。
 *
 * 连线校验允许若干跨类型连接（json→string、string→number 等），但运行时此前
 * 原样透传，由各适配器自己 String() / Number() / Boolean()。结果是一批静默错误：
 *
 * - json→string：`String(对象)` 得到 `"[object Object]"`，还会被拿去算哈希
 * - string→number：`Number("abc")` 得到 NaN，汇率节点照样输出 NaN
 * - string→boolean：`Boolean("false")` 是 true
 *
 * 这些节点看起来跑成功了，只是结果是错的。现在在边上做一次显式转换，
 * 转不过去就报错——错误可见，好过一个看似正确的结果。
 */

export class PortConversionError extends Error {
  constructor(
    readonly from: DataType,
    readonly to: DataType,
    detail: string,
  ) {
    super(`无法把 ${from} 转换为 ${to}：${detail}`)
    this.name = "PortConversionError"
  }
}

const TRUTHY = new Set(["true", "1", "yes", "y", "on"])
const FALSY = new Set(["false", "0", "no", "n", "off", ""])

function toStringValue(value: unknown, from: DataType): string {
  if (typeof value === "string") return value
  if (value === null && from === "json") return "null"
  if (value === null || value === undefined) return ""
  if (from === "json" || typeof value === "object") {
    try {
      // 关键:对象要序列化成 JSON,而不是 String(obj) 得到 "[object Object]"
      const json = JSON.stringify(value)
      if (json === undefined) throw new Error("值无法序列化")
      return json
    } catch (error) {
      throw new PortConversionError(from, "string", (error as Error).message)
    }
  }
  return String(value)
}

function toNumberValue(value: unknown, from: DataType): number {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new PortConversionError(from, "number", "不是有限数值")
    }
    return value
  }
  if (typeof value === "boolean") return value ? 1 : 0
  if (typeof value === "string") {
    const trimmed = value.trim()
    if (trimmed === "") throw new PortConversionError(from, "number", "输入为空")
    const parsed = Number(trimmed)
    if (!Number.isFinite(parsed)) {
      throw new PortConversionError(from, "number", `"${trimmed}" 不是数值`)
    }
    return parsed
  }
  throw new PortConversionError(from, "number", "不是数值")
}

function toBooleanValue(value: unknown, from: DataType): boolean {
  if (typeof value === "boolean") return value
  if (typeof value === "number") return value !== 0
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase()
    if (TRUTHY.has(normalized)) return true
    if (FALSY.has(normalized)) return false
    // 不做 Boolean(value) —— 那样 "false" 会变成 true
    throw new PortConversionError(from, "boolean", `"${value}" 既不是真也不是假`)
  }
  throw new PortConversionError(from, "boolean", "不是布尔值")
}

function toJsonValue(value: unknown, from: DataType): unknown {
  if (typeof value !== "string") return value
  const trimmed = value.trim()
  if (trimmed === "") throw new PortConversionError(from, "json", "输入为空")
  try {
    return JSON.parse(trimmed)
  } catch (error) {
    throw new PortConversionError(from, "json", (error as Error).message)
  }
}

/**
 * 把某个输出端口的值转成目标输入端口期望的类型。
 * 同类型直接透传；bytes 不参与任何转换（矩阵里它只和自身兼容）。
 */
export function convertPortValue(value: unknown, from: DataType, to: DataType): unknown {
  if (from === to) return value
  if (from === "bytes" || to === "bytes") {
    throw new PortConversionError(from, to, "二进制数据不能与其它类型互转")
  }
  // NaN / Infinity 跨类型时同样要拦住:转成字符串会得到 "NaN" 继续往下游传
  if (typeof value === "number" && !Number.isFinite(value)) {
    throw new PortConversionError(from, to, "不是有限数值")
  }

  switch (to) {
    case "string":
      return toStringValue(value, from)
    case "number":
      return toNumberValue(value, from)
    case "boolean":
      return toBooleanValue(value, from)
    case "json":
      return toJsonValue(value, from)
    default:
      return value
  }
}

/** 输出端口的类型：派生输出优先，其次是标了 hasOutput 的配置字段 */
export function resolveOutputPortType(
  definition: NodeDefinition,
  portId: string,
): DataType | undefined {
  const derived = definition.outputs.find((port) => port.id === portId)
  if (derived) return derived.dataType
  return definition.config.find((field) => field.hasOutput && field.id === portId)?.dataType
}

/** 输入端口的类型 */
export function resolveInputPortType(
  definition: NodeDefinition,
  portId: string,
): DataType | undefined {
  return definition.config.find((field) => field.hasInput && field.id === portId)?.dataType
}
