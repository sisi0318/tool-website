export function escapeJsonText(value: string): string {
  return JSON.stringify(value).slice(1, -1)
}

export function unescapeJsonText(value: string): string {
  const trimmed = value.trim()
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    const parsed = JSON.parse(trimmed)
    if (typeof parsed !== "string") throw new Error("输入不是 JSON 字符串")
    return parsed
  }

  const safeMultilineValue = value
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n")
    .replace(/\t/g, "\\t")
    .replace(/\f/g, "\\f")
    .replace(/\u0008/g, "\\b")
  return JSON.parse(`"${safeMultilineValue}"`)
}

export function tryRepairCommonJson(value: string): unknown | null {
  const repaired = value
    .replace(/,\s*([}\]])/g, "$1")
    .replace(/([{,]\s*)([A-Za-z_$][\w$]*)(\s*:)/g, '$1"$2"$3')

  if (repaired === value) return null
  try {
    return JSON.parse(repaired)
  } catch {
    return null
  }
}

/**
 * 递归按键名排序。
 *
 * 不能用 `JSON.stringify(value, Object.keys(value).sort())`:replacer 数组是
 * 作用于所有层级的键名白名单,嵌套对象里不在顶层键名表中的字段会被整体丢弃
 * (`{"b":{"x":1},"a":2}` 会变成 `{"a":2,"b":{}}`),数组还会退化成按索引筛选。
 */
export function sortJsonKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJsonKeys)
  if (value === null || typeof value !== "object") return value

  return Object.fromEntries(
    Object.keys(value as Record<string, unknown>)
      .sort()
      .map((key) => [key, sortJsonKeys((value as Record<string, unknown>)[key])]),
  )
}
