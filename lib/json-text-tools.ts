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
