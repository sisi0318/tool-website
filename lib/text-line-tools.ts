export type TextLineOperation = "clean" | "dedupe" | "sort" | "affix" | "columns" | "union" | "intersection" | "difference" | "symmetric-difference"
export interface TextLineOptions {
  operation?: TextLineOperation; other?: string; trim?: boolean; removeEmpty?: boolean; ignoreCase?: boolean; sortMode?: "lexical" | "natural" | "numeric"; descending?: boolean; prefix?: string; suffix?: string; delimiter?: string; whitespaceDelimiter?: boolean; columns?: string; outputDelimiter?: string; missingColumn?: "empty" | "error"; newline?: "lf" | "crlf"; trailingNewline?: boolean
}
export interface TextLineResult { output: string; lines: string[]; inputLines: number; otherLines: number; emptyRemoved: number; duplicatesRemoved: number }
export class TextLineError extends Error {
  constructor(public code: "inputLimit" | "lineLimit" | "outputLimit" | "invalidOperation" | "invalidColumn" | "missingColumn" | "invalidNumber" | "invalidOption", public line?: number) { super(code + (line ? `: ${line}` : "")); this.name = "TextLineError" }
}
export const TEXT_LINE_LIMITS = { inputChars: 8 * 1024 * 1024, lines: 100_000, outputChars: 16 * 1024 * 1024, columns: 1000 } as const
export const SET_LINE_OPERATIONS: TextLineOperation[] = ["union", "intersection", "difference", "symmetric-difference"]

export function splitTextLines(input: string): string[] {
  if (!input) return []
  const lines = input.split(/\r\n|\r|\n/)
  if (/(?:\r\n|\r|\n)$/.test(input)) lines.pop()
  return lines
}
function selectedColumns(input: string): number[] {
  if (!input.trim() || input.length > 10000) throw new TextLineError("invalidColumn")
  const output: number[] = []
  for (const token of input.split(",")) {
    const match = /^\s*(\d+)(?:\s*-\s*(\d+))?\s*$/.exec(token)
    if (!match) throw new TextLineError("invalidColumn")
    const start = Number(match[1]), end = Number(match[2] ?? match[1])
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 1 || end < start || end > TEXT_LINE_LIMITS.columns || output.length + end - start + 1 > TEXT_LINE_LIMITS.columns) throw new TextLineError("invalidColumn")
    for (let index = start; index <= end; index++) output.push(index - 1)
  }
  return output
}

interface Decimal { sign: number; magnitude: number; digits: string }
function decimal(input: string, line: number): Decimal {
  const match = /^([+-]?)(?:(\d+)(?:\.(\d*))?|\.(\d+))(?:[eE]([+-]?\d+))?$/.exec(input.trim())
  if (!match || (match[5]?.length ?? 0) > 8) throw new TextLineError("invalidNumber", line)
  const exponent = Number(match[5] ?? "0")
  if (Math.abs(exponent) > 1_000_000) throw new TextLineError("invalidNumber", line)
  const whole = match[2] ?? "", combined = whole + (match[3] ?? match[4] ?? ""), zeros = /^0*/.exec(combined)![0].length
  const digits = combined.slice(zeros).replace(/0+$/, "")
  return { sign: digits ? match[1] === "-" ? -1 : 1 : 0, magnitude: whole.length - zeros + exponent, digits }
}
function compareDecimals(a: Decimal, b: Decimal): number {
  if (a.sign !== b.sign) return a.sign - b.sign
  if (!a.sign) return 0
  if (a.magnitude !== b.magnitude) return (a.magnitude - b.magnitude) * a.sign
  const width = Math.max(a.digits.length, b.digits.length)
  for (let index = 0; index < width; index++) { const diff = (a.digits.charCodeAt(index) || 48) - (b.digits.charCodeAt(index) || 48); if (diff) return diff * a.sign }
  return 0
}

export function processTextLines(input: string, options: TextLineOptions = {}): TextLineResult {
  const operation = options.operation ?? "dedupe", isSet = SET_LINE_OPERATIONS.includes(operation), other = isSet ? options.other ?? "" : ""
  if (!["clean", "dedupe", "sort", "affix", "columns", ...SET_LINE_OPERATIONS].includes(operation)) throw new TextLineError("invalidOperation")
  if (input.length + other.length > TEXT_LINE_LIMITS.inputChars) throw new TextLineError("inputLimit")
  if (options.newline !== undefined && !["lf", "crlf"].includes(options.newline)) throw new TextLineError("invalidOption")
  const leftRaw = splitTextLines(input), rightRaw = splitTextLines(other)
  if (leftRaw.length + rightRaw.length > TEXT_LINE_LIMITS.lines) throw new TextLineError("lineLimit")
  let emptyRemoved = 0, duplicatesRemoved = 0
  const prepare = (lines: string[]) => lines.map((line, index) => ({ text: options.trim ? line.trim() : line, line: index + 1 })).filter((entry) => { if (options.removeEmpty !== false && !entry.text.trim()) { emptyRemoved++; return false }; return true })
  const left = prepare(leftRaw), right = prepare(rightRaw)
  const key = (line: string) => options.ignoreCase ? line.toLowerCase() : line
  const unique = (lines: typeof left) => { const seen = new Set<string>(); return lines.filter((entry) => { const value = key(entry.text); if (seen.has(value)) { duplicatesRemoved++; return false }; seen.add(value); return true }) }
  let lines: string[]
  if (operation === "dedupe") lines = unique(left).map((entry) => entry.text)
  else if (isSet) {
    const a = unique(left), b = unique(right), aKeys = new Set(a.map((entry) => key(entry.text))), bKeys = new Set(b.map((entry) => key(entry.text)))
    const entries = operation === "union" ? [...a, ...b.filter((entry) => !aKeys.has(key(entry.text)))] : operation === "intersection" ? a.filter((entry) => bKeys.has(key(entry.text))) : operation === "difference" ? a.filter((entry) => !bKeys.has(key(entry.text))) : [...a.filter((entry) => !bKeys.has(key(entry.text))), ...b.filter((entry) => !aKeys.has(key(entry.text)))]
    lines = entries.map((entry) => entry.text)
  } else if (operation === "sort") {
    const mode = options.sortMode ?? "lexical"
    if (!["lexical", "natural", "numeric"].includes(mode)) throw new TextLineError("invalidOption")
    const collator = mode === "natural" ? new Intl.Collator("en", { numeric: true, sensitivity: options.ignoreCase ? "accent" : "variant" }) : null
    const sorted = left.map((entry, index) => ({ ...entry, index, key: key(entry.text), number: mode === "numeric" ? decimal(entry.text, entry.line) : null }))
    sorted.sort((a, b) => { const compared = mode === "numeric" ? compareDecimals(a.number!, b.number!) : collator ? collator.compare(a.text, b.text) : a.key < b.key ? -1 : a.key > b.key ? 1 : 0; return (options.descending ? -compared : compared) || a.index - b.index })
    lines = sorted.map((entry) => entry.text)
  } else if (operation === "affix") {
    const prefix = options.prefix ?? "", suffix = options.suffix ?? ""
    if (/[\r\n]/.test(prefix + suffix)) throw new TextLineError("invalidOption")
    if (left.reduce((size, entry) => size + entry.text.length + prefix.length + suffix.length + 2, 0) > TEXT_LINE_LIMITS.outputChars) throw new TextLineError("outputLimit")
    lines = left.map((entry) => prefix + entry.text + suffix)
  } else if (operation === "columns") {
    const selected = selectedColumns(options.columns ?? "1"), delimiter = options.delimiter ?? "\t", separator = options.outputDelimiter ?? "\t"
    if ((!options.whitespaceDelimiter && !delimiter) || /[\r\n]/.test(delimiter + separator) || (options.missingColumn !== undefined && !["empty", "error"].includes(options.missingColumn))) throw new TextLineError("invalidOption")
    let size = 0
    lines = left.map((entry) => {
      const cells = options.whitespaceDelimiter ? entry.text.trim().split(/\s+/) : entry.text.split(delimiter)
      if (options.missingColumn === "error" && selected.some((index) => index >= cells.length)) throw new TextLineError("missingColumn", entry.line)
      const values = selected.map((index) => cells[index] ?? "")
      size += values.reduce((length, value) => length + value.length, 0) + Math.max(0, values.length - 1) * separator.length + 2
      if (size > TEXT_LINE_LIMITS.outputChars) throw new TextLineError("outputLimit")
      return values.join(separator)
    })
  } else lines = left.map((entry) => entry.text)
  const newline = options.newline === "crlf" ? "\r\n" : "\n"
  if (lines.reduce((size, line) => size + line.length + newline.length, 0) > TEXT_LINE_LIMITS.outputChars) throw new TextLineError("outputLimit")
  return { output: lines.join(newline) + (options.trailingNewline && lines.length ? newline : ""), lines, inputLines: leftRaw.length, otherLines: rightRaw.length, emptyRemoved, duplicatesRemoved }
}
