export type QRContentType = "text" | "url" | "wifi" | "phone" | "email" | "location" | "vcard" | "json"

export interface ParsedQRContent {
  type: QRContentType
  details: Record<string, unknown>
}

function splitEscaped(value: string, separator: string): string[] {
  const parts: string[] = []
  let current = ""
  let escaped = false

  for (const character of value) {
    if (escaped) {
      current += `\\${character}`
      escaped = false
    } else if (character === "\\") {
      escaped = true
    } else if (character === separator) {
      parts.push(current)
      current = ""
    } else {
      current += character
    }
  }

  if (escaped) current += "\\"
  parts.push(current)
  return parts
}

function findUnescapedSeparator(value: string, separator: string): number {
  let escaped = false
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index]
    if (escaped) {
      escaped = false
    } else if (character === "\\") {
      escaped = true
    } else if (character === separator) {
      return index
    }
  }
  return -1
}

function unescapeWifiValue(value: string): string {
  return value.replace(/\\([\\;,:"])/g, "$1")
}

function parseWifiContent(data: string): ParsedQRContent {
  const fields: Record<string, string> = {}
  for (const segment of splitEscaped(data.slice(5), ";")) {
    const separatorIndex = findUnescapedSeparator(segment, ":")
    if (separatorIndex <= 0) continue
    const key = segment.slice(0, separatorIndex).trim().toUpperCase()
    fields[key] = unescapeWifiValue(segment.slice(separatorIndex + 1))
  }

  return {
    type: "wifi",
    details: {
      type: fields.T || "WPA",
      ssid: fields.S || "",
      password: fields.P || "",
      hidden: fields.H?.toLowerCase() === "true",
    },
  }
}

function parseVCard(data: string): ParsedQRContent {
  const unfolded = data.replace(/\r?\n[ \t]/g, "")
  const details: Record<string, string> = {}

  for (const line of unfolded.split(/\r?\n/)) {
    const separatorIndex = line.indexOf(":")
    if (separatorIndex <= 0) continue
    const rawKey = line.slice(0, separatorIndex)
    const key = rawKey.split(";")[0].toLowerCase()
    if (!["fn", "org", "tel", "email", "url"].includes(key) || details[key]) continue
    details[key] = line.slice(separatorIndex + 1).replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1")
  }

  return { type: "vcard", details }
}

export function parseQRContent(data: string): ParsedQRContent {
  const trimmed = data.trim()

  if (/^https?:\/\//i.test(trimmed)) {
    return { type: "url", details: { url: trimmed } }
  }

  if (/^WIFI:/i.test(trimmed)) {
    return parseWifiContent(trimmed)
  }

  if (/^tel:/i.test(trimmed) || /^[+]?[\d\s\-().]{7,}$/.test(trimmed)) {
    return {
      type: "phone",
      details: { phone: trimmed.replace(/^tel:/i, "").split("?")[0] },
    }
  }

  if (/^mailto:/i.test(trimmed) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    const rawEmail = trimmed.replace(/^mailto:/i, "").split("?")[0]
    let email = rawEmail
    try {
      email = decodeURIComponent(rawEmail)
    } catch {
      // Keep the original payload when percent encoding is malformed.
    }
    return { type: "email", details: { email } }
  }

  if (/^geo:/i.test(trimmed)) {
    const match = trimmed.match(/^geo:([^,]+),([^,?]+)/i)
    const latitude = Number(match?.[1])
    const longitude = Number(match?.[2])
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      return {
        type: "location",
        details: {
          latitude,
          longitude,
          url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}`,
        },
      }
    }
  }

  if (/^BEGIN:VCARD/i.test(trimmed)) {
    return parseVCard(trimmed)
  }

  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    try {
      return { type: "json", details: { value: JSON.parse(trimmed) } }
    } catch {
      // Invalid JSON is still useful as plain text.
    }
  }

  return { type: "text", details: {} }
}

export function csvCell(value: unknown): string {
  const source = value === undefined || value === null
    ? ""
    : typeof value === "string"
      ? value
      : JSON.stringify(value)
  const formulaSafe = /^[=+\-@]/.test(source) ? `'${source}` : source
  return `"${formulaSafe.replace(/"/g, '""')}"`
}
