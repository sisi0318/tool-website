import { XMLValidator } from "fast-xml-parser"

export type DetectedDataType =
  | "json"
  | "jwt"
  | "base64"
  | "hex"
  | "url-encoded"
  | "xml"
  | "timestamp"
  | "pem"
  | "csv"
  | "uuid"
  | "gzip"
  | "zip"
  | "plain-text"

export interface DetectionMatch {
  type: DetectedDataType
  confidence: number
  label: string
  detail: string
  suggestedTool?: string
  decodedPreview?: string
}

export interface DetectionResult {
  best: DetectionMatch
  matches: DetectionMatch[]
}

function decodeBase64Bytes(value: string): Uint8Array | null {
  const normalized = value.replace(/\s+/g, "")
  if (!normalized || normalized.length % 4 === 1 || !/^[A-Za-z0-9+/]*={0,2}$/.test(normalized)) return null
  try {
    const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="))
    return Uint8Array.from(binary, (character) => character.charCodeAt(0))
  } catch {
    return null
  }
}

function decodeUtf8(bytes: Uint8Array): string | undefined {
  try {
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes)
    return /[\u0000-\u0008\u000e-\u001f]/.test(decoded) ? undefined : decoded
  } catch {
    return undefined
  }
}

function decodeBase64Url(value: string): string | undefined {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/")
  const bytes = decodeBase64Bytes(normalized)
  return bytes ? decodeUtf8(bytes) : undefined
}

function detectCsv(value: string): { delimiter: string; columns: number } | null {
  const lines = value.split(/\r?\n/).filter((line) => line.trim()).slice(0, 8)
  if (lines.length < 2) return null
  for (const delimiter of [",", "\t", ";", "|"]) {
    const counts = lines.map((line) => line.split(delimiter).length)
    if (counts[0] > 1 && counts.every((count) => count === counts[0])) {
      return { delimiter: delimiter === "\t" ? "tab" : delimiter, columns: counts[0] }
    }
  }
  return null
}

export function detectData(input: string): DetectionResult {
  const value = input.trim()
  const matches: DetectionMatch[] = []

  if (!value) {
    const empty: DetectionMatch = {
      type: "plain-text",
      confidence: 0,
      label: "Plain text",
      detail: "No input",
    }
    return { best: { ...empty }, matches: [empty] }
  }

  try {
    const parsed = JSON.parse(value)
    const structured = typeof parsed === "object" && parsed !== null
    matches.push({
      type: "json",
      confidence: structured ? 0.99 : 0.55,
      label: "JSON",
      detail: Array.isArray(parsed) ? `Array with ${parsed.length} items` : typeof parsed === "object" && parsed ? `Object with ${Object.keys(parsed).length} keys` : `JSON ${typeof parsed}`,
      suggestedTool: "json",
      decodedPreview: JSON.stringify(parsed, null, 2),
    })
  } catch {}

  const jwtParts = value.split(".")
  if (jwtParts.length === 3 && jwtParts.every((part) => /^[A-Za-z0-9_-]+$/.test(part))) {
    try {
      const header = decodeBase64Url(jwtParts[0])
      const payload = decodeBase64Url(jwtParts[1])
      if (header && payload) {
        const decoded = { header: JSON.parse(header), payload: JSON.parse(payload) }
        matches.push({
          type: "jwt",
          confidence: 0.99,
          label: "JWT",
          detail: `JSON Web Token · ${decoded.header.alg ?? "unknown algorithm"}`,
          suggestedTool: "jwt",
          decodedPreview: JSON.stringify(decoded, null, 2),
        })
      }
    } catch {}
  }

  const pemMatch = value.match(/^-----BEGIN ([A-Z0-9 ]+)-----/)
  if (pemMatch) {
    matches.push({
      type: "pem",
      confidence: 0.99,
      label: "PEM",
      detail: pemMatch[1],
      suggestedTool: "certificate",
    })
  }

  if (value.startsWith("<") && XMLValidator.validate(value) === true) {
    const root = value.match(/^\s*(?:<\?xml[^>]*>\s*)?<([\w:.-]+)/)?.[1]
    matches.push({
      type: "xml",
      confidence: 0.98,
      label: "XML",
      detail: root ? `Root element: ${root}` : "Well-formed XML",
      suggestedTool: "xml",
    })
  }

  if (/^[0-9a-fA-F]+$/.test(value) && value.length >= 4 && value.length % 2 === 0) {
    const bytes = Uint8Array.from(value.match(/../g) ?? [], (pair) => Number.parseInt(pair, 16))
    matches.push({
      type: "hex",
      confidence: value.length >= 16 ? 0.9 : 0.72,
      label: "Hexadecimal",
      detail: `${bytes.length} bytes`,
      suggestedTool: "hex-binary",
      decodedPreview: decodeUtf8(bytes),
    })
  }

  const base64Bytes = decodeBase64Bytes(value)
  if (base64Bytes && value.length >= 8) {
    const signature = [...base64Bytes.slice(0, 4)]
    const compressedType = signature[0] === 0x1f && signature[1] === 0x8b
      ? "gzip"
      : signature[0] === 0x50 && signature[1] === 0x4b
        ? "zip"
        : null
    if (compressedType) {
      matches.push({
        type: compressedType,
        confidence: 0.99,
        label: compressedType.toUpperCase(),
        detail: `${base64Bytes.length} compressed bytes encoded as Base64`,
        suggestedTool: "compression",
      })
    }
    matches.push({
      type: "base64",
      confidence: decodeUtf8(base64Bytes) ? 0.91 : 0.78,
      label: "Base64",
      detail: `${base64Bytes.length} decoded bytes`,
      suggestedTool: "encoding",
      decodedPreview: decodeUtf8(base64Bytes),
    })
  }

  if (/%[0-9a-fA-F]{2}/.test(value)) {
    try {
      matches.push({
        type: "url-encoded",
        confidence: 0.9,
        label: "URL encoded",
        detail: "Percent-encoded text",
        suggestedTool: "encoding",
        decodedPreview: decodeURIComponent(value.replace(/\+/g, " ")),
      })
    } catch {}
  }

  if (/^\d{10}$|^\d{13}$/.test(value)) {
    const milliseconds = value.length === 10 ? Number(value) * 1000 : Number(value)
    const date = new Date(milliseconds)
    if (!Number.isNaN(date.getTime()) && date.getUTCFullYear() >= 1970 && date.getUTCFullYear() <= 2500) {
      matches.push({
        type: "timestamp",
        confidence: 0.88,
        label: "Unix timestamp",
        detail: date.toISOString(),
        suggestedTool: "time",
        decodedPreview: date.toISOString(),
      })
    }
  }

  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    matches.push({
      type: "uuid",
      confidence: 0.99,
      label: "UUID",
      detail: `Version ${value[14]}`,
      suggestedTool: "uuid",
    })
  }

  const csv = detectCsv(value)
  if (csv) {
    matches.push({
      type: "csv",
      confidence: 0.82,
      label: "Delimited data",
      detail: `${csv.columns} columns · delimiter ${csv.delimiter}`,
      suggestedTool: "csv",
    })
  }

  matches.push({
    type: "plain-text",
    confidence: 0.35,
    label: "Plain text",
    detail: `${value.length} characters`,
    suggestedTool: "text-stats",
  })

  matches.sort((a, b) => b.confidence - a.confidence)
  return { best: { ...matches[0] }, matches }
}
