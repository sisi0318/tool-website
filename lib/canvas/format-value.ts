export function formatCanvasValue(value: unknown, pretty = false): string {
  if (value === undefined) return ""
  if (value === null) return "null"

  if (typeof File !== "undefined" && value instanceof File) {
    const size = value.size < 1024
      ? `${value.size} B`
      : `${(value.size / 1024).toFixed(1)} KB`
    return `${value.name} (${size})`
  }

  if (typeof value !== "object") return String(value)

  const seen = new WeakSet<object>()
  try {
    return JSON.stringify(
      value,
      (_key, nestedValue: unknown) => {
        if (typeof nestedValue !== "object" || nestedValue === null) return nestedValue
        if (seen.has(nestedValue)) return "[Circular]"
        seen.add(nestedValue)
        return nestedValue
      },
      pretty ? 2 : undefined
    )
  } catch {
    return String(value)
  }
}
