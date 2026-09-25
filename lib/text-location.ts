/** 文本里的位置，行列都从 1 开始；列按 UTF-16 码元计，和 textarea 的选区一致 */
export interface TextLocation {
  line: number
  column: number
}

/** 带出错位置的错误。lib 能算出位置时抛它，页面据此显示“第几行第几列”并能定位过去 */
export class LocatedError extends Error {
  constructor(message: string, readonly location: TextLocation | null) {
    super(message)
    this.name = "LocatedError"
  }
}

export function locationAt(text: string, offset: number): TextLocation {
  const before = text.slice(0, Math.max(0, Math.min(offset, text.length)))
  const lineStart = before.lastIndexOf("\n") + 1
  let line = 1
  for (let index = before.indexOf("\n"); index !== -1; index = before.indexOf("\n", index + 1)) line += 1
  return { line, column: before.length - lineStart + 1 }
}

export function offsetOf(text: string, { line, column }: TextLocation): number {
  let offset = 0
  for (let current = 1; current < line; current += 1) {
    const next = text.indexOf("\n", offset)
    if (next === -1) return text.length
    offset = next + 1
  }
  const lineEnd = text.indexOf("\n", offset)
  return Math.min(lineEnd === -1 ? text.length : lineEnd, offset + Math.max(0, column - 1))
}

/**
 * 从常见的报错文字里取位置："line 3 column 5"、"line 3, col 5"、"(3:5)"、
 * "at position 42"（按原文换算成行列）。认不出时返回 null。
 */
export function locationFromMessage(message: string, text?: string): TextLocation | null {
  const lineColumn = /line\s*(\d+)\s*,?\s*col(?:umn)?\s*(\d+)/i.exec(message) ?? /\((\d+):(\d+)\)/.exec(message)
  if (lineColumn) return { line: Number(lineColumn[1]), column: Number(lineColumn[2]) }
  const position = /position\s+(\d+)/i.exec(message)
  if (position && text !== undefined) return locationAt(text, Number(position[1]))
  return null
}

const JSON_NUMBER = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y
const JSON_ESCAPES = "\"\\/bfnrtu"

/** JSON 语法扫描：返回第一个语法错误所在的偏移，合法时返回 null */
export function findJsonErrorOffset(text: string): number | null {
  let index = 0
  const fail = (at = index): never => { throw at }
  const skipSpace = () => { while (index < text.length && " \t\n\r".includes(text[index])) index += 1 }
  const literal = (word: string) => { if (text.startsWith(word, index)) index += word.length; else fail() }
  const string = () => {
    index += 1
    while (index < text.length) {
      const char = text[index]
      if (char === "\"") { index += 1; return }
      if (char === "\\") {
        const escape = text[index + 1]
        if (escape === undefined || !JSON_ESCAPES.includes(escape)) fail()
        if (escape === "u" && !/^[0-9a-fA-F]{4}$/.test(text.slice(index + 2, index + 6))) fail()
        index += escape === "u" ? 6 : 2
        continue
      }
      if (char < " ") fail()
      index += 1
    }
    fail()
  }
  const number = () => {
    JSON_NUMBER.lastIndex = index
    const match = JSON_NUMBER.exec(text)
    if (!match) fail()
    else index += match[0].length
  }
  const value = () => {
    skipSpace()
    const char = text[index]
    if (char === "{") object()
    else if (char === "[") array()
    else if (char === "\"") string()
    else if (char === "t") literal("true")
    else if (char === "f") literal("false")
    else if (char === "n") literal("null")
    else if (char === "-" || (char >= "0" && char <= "9")) number()
    else fail()
  }
  const object = () => {
    index += 1
    skipSpace()
    if (text[index] === "}") { index += 1; return }
    for (;;) {
      skipSpace()
      if (text[index] !== "\"") fail()
      string()
      skipSpace()
      if (text[index] !== ":") fail()
      index += 1
      value()
      skipSpace()
      if (text[index] === ",") { index += 1; continue }
      if (text[index] === "}") { index += 1; return }
      fail()
    }
  }
  const array = () => {
    index += 1
    skipSpace()
    if (text[index] === "]") { index += 1; return }
    for (;;) {
      value()
      skipSpace()
      if (text[index] === ",") { index += 1; continue }
      if (text[index] === "]") { index += 1; return }
      fail()
    }
  }

  try {
    value()
    skipSpace()
    if (index < text.length) fail()
    return null
  } catch (at) {
    // 嵌套过深导致栈溢出时就不给位置了
    return typeof at === "number" ? at : null
  }
}

/**
 * JSON.parse 失败时的出错位置。新版 V8 的报错常常只有 `… is not valid JSON`，
 * 不带位置，这时自己扫描一遍。
 */
export function jsonErrorLocation(text: string, error?: unknown): TextLocation | null {
  const fromMessage = error instanceof Error ? locationFromMessage(error.message, text) : null
  if (fromMessage) return fromMessage
  const offset = findJsonErrorOffset(text)
  return offset === null ? null : locationAt(text, offset)
}

/** JSON.parse，失败时抛带位置的 LocatedError（保留引擎原来的说明） */
export function parseJsonLocated(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch (error) {
    throw new LocatedError(error instanceof Error ? error.message : "Invalid JSON", jsonErrorLocation(text, error))
  }
}
