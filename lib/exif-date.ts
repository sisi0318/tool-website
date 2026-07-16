export function parseExifDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  if (typeof value === "number") {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }
  if (typeof value !== "string") return null

  const trimmed = value.trim()
  const exifMatch = trimmed.match(
    /^(\d{4}):(\d{2}):(\d{2})(?:[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?)?(?:\s*([+-]\d{2}:\d{2}|Z))?$/,
  )
  if (exifMatch) {
    const [, year, month, day, hour = "0", minute = "0", second = "0", fraction = "0", offset] = exifMatch
    const milliseconds = Number.parseInt(fraction.padEnd(3, "0").slice(0, 3), 10)
    const date = offset
      ? new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}.${milliseconds.toString().padStart(3, "0")}${offset}`)
      : new Date(
          Number(year),
          Number(month) - 1,
          Number(day),
          Number(hour),
          Number(minute),
          Number(second),
          milliseconds,
        )
    return Number.isNaN(date.getTime()) ? null : date
  }

  const date = new Date(trimmed)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatExifDate(value: unknown, dateOnly = false): string {
  const date = parseExifDate(value)
  if (!date) return String(value ?? "")
  return dateOnly ? date.toLocaleDateString() : date.toLocaleString()
}
