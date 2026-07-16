import { format, type KeywordCase, type SqlLanguage } from "sql-formatter"

export type SqlOperation = "format" | "minify"
export type SqlDialect = SqlLanguage

export interface SqlFormatOptions {
  language?: SqlDialect
  keywordCase?: KeywordCase
  tabWidth?: number
  useTabs?: boolean
}

export function formatSql(input: string, options: SqlFormatOptions = {}): string {
  return format(input, {
    language: options.language ?? "sql",
    keywordCase: options.keywordCase ?? "upper",
    tabWidth: options.tabWidth ?? 2,
    useTabs: options.useTabs ?? false,
    linesBetweenQueries: 1,
  })
}

// Only punctuation that is always safe to join. Operators keep one existing
// whitespace boundary so `- -` cannot accidentally become a `--` comment.
const TIGHT_CHARACTERS = new Set(["(", ")", ",", ";", "."])

/** Collapse SQL whitespace and comments while preserving quoted values and identifiers. */
export function minifySql(input: string): string {
  let output = ""
  let index = 0
  let pendingSpace = false

  const append = (value: string) => {
    if (pendingSpace && output && !TIGHT_CHARACTERS.has(output.at(-1) ?? "") && !TIGHT_CHARACTERS.has(value[0] ?? "")) {
      output += " "
    }
    output += value
    pendingSpace = false
  }

  while (index < input.length) {
    const character = input[index]
    const next = input[index + 1]

    if (/\s/.test(character)) {
      pendingSpace = true
      index += 1
      continue
    }

    const previous = input[index - 1]
    const afterCommentToken = input[index + 2]
    const startsLineComment =
      character === "-" &&
      next === "-" &&
      (
        index === 0 ||
        /\s/.test(previous) ||
        /\s/.test(afterCommentToken ?? "") ||
        previous === ";"
      )

    if (startsLineComment) {
      index += 2
      while (index < input.length && input[index] !== "\n" && input[index] !== "\r") index += 1
      pendingSpace = true
      continue
    }

    if (character === "/" && next === "*") {
      const end = input.indexOf("*/", index + 2)
      if (end === -1) throw new Error("Unclosed SQL block comment")
      index = end + 2
      pendingSpace = true
      continue
    }

    if (character === "'" || character === '"' || character === "`" || character === "[") {
      const closing = character === "[" ? "]" : character
      let quoted = character
      index += 1
      let closed = false
      while (index < input.length) {
        const current = input[index]
        quoted += current
        index += 1
        if (current !== closing) continue
        if (input[index] === closing) {
          quoted += input[index]
          index += 1
          continue
        }
        if (closing !== "]") {
          let backslashCount = 0
          for (let cursor = index - 2; cursor >= 0 && input[cursor] === "\\"; cursor -= 1) {
            backslashCount += 1
          }
          if (backslashCount % 2 === 1) continue
        }
        closed = true
        break
      }
      if (!closed) throw new Error("Unclosed quoted SQL value")
      append(quoted)
      continue
    }

    if (TIGHT_CHARACTERS.has(character)) {
      output = output.trimEnd() + character
      pendingSpace = false
      index += 1
      continue
    }

    append(character)
    index += 1
  }

  return output.trim()
}

export function processSql(input: string, operation: SqlOperation, options: SqlFormatOptions = {}): string {
  return operation === "minify" ? minifySql(input) : formatSql(input, options)
}
