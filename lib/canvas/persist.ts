import type { NodeInstance } from "./types"

/**
 * 画布状态会被 JSON.stringify 写进 localStorage / 导出文件,
 * 而 File/Blob 序列化后是 `{}` —— 重新加载时这个空对象仍然为真值,
 * 下游节点会把它当文件用并抛 "file.arrayBuffer is not a function"。
 * 写盘前统一剥掉这类值,让它变成"缺失"而不是"坏值"。
 */
export function stripUnpersistableConfig(
  config: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  if (!config || typeof config !== "object") return result
  for (const [key, value] of Object.entries(config)) {
    if (value === undefined || typeof value === "function") continue
    if (typeof Blob !== "undefined" && value instanceof Blob) continue
    if (typeof File !== "undefined" && value instanceof File) continue
    try {
      if (JSON.stringify(value) === undefined) continue
      result[key] = value
    } catch {
      // 循环引用等无法序列化的值直接丢弃
    }
  }
  return result
}

export function stripUnpersistableNodes(nodes: NodeInstance[]): NodeInstance[] {
  return nodes.map((node) => ({ ...node, config: stripUnpersistableConfig(node.config) }))
}

/**
 * 把配置值当文件用之前的守卫。除了新写入的状态,历史遗留的持久化数据里
 * 仍可能存着 `{}` —— 那是个为真的空对象,直接调用 file.arrayBuffer() 会抛异常。
 */
export function asFile(value: unknown): File | null {
  return typeof File !== "undefined" && value instanceof File ? value : null
}
