export type DiffType = "unchanged" | "added" | "removed"
export type DiffMode = "quick" | "precise"
export type DiffFallbackReason = "line-limit" | "work-limit" | "trace-limit"

export interface DiffLine {
  type: DiffType
  content: string
}

export interface DiffResult {
  lines: DiffLine[]
  algorithmUsed: "quick" | "myers"
  fallbackReason: DiffFallbackReason | null
  added: number
  removed: number
  unchanged: number
}

export interface DiffOptions {
  maxPreciseLines?: number
  maxOperations?: number
  maxTraceEntries?: number
  /** 比较时忽略空白的差异（行首行尾的空白、连续空白的多少），显示的仍是原文 */
  ignoreWhitespace?: boolean
}

type DiffLimits = Required<Omit<DiffOptions, "ignoreWhitespace">>

const DEFAULT_MAX_PRECISE_LINES = 20_000
const DEFAULT_MAX_OPERATIONS = 1_000_000
const DEFAULT_MAX_TRACE_ENTRIES = 250_000

function splitLines(text: string): string[] {
  return text === "" ? [] : text.split("\n")
}

function summarize(
  lines: DiffLine[],
  algorithmUsed: DiffResult["algorithmUsed"],
  fallbackReason: DiffFallbackReason | null,
): DiffResult {
  let added = 0
  let removed = 0
  let unchanged = 0

  for (const line of lines) {
    if (line.type === "added") added++
    else if (line.type === "removed") removed++
    else unchanged++
  }

  return {
    lines,
    algorithmUsed,
    fallbackReason,
    added,
    removed,
    unchanged,
  }
}

export function quickLineDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = splitLines(oldText)
  const newLines = splitLines(newText)
  const lines: DiffLine[] = []
  let oldIndex = 0
  let newIndex = 0

  while (oldIndex < oldLines.length || newIndex < newLines.length) {
    const oldLine = oldLines[oldIndex]
    const newLine = newLines[newIndex]

    if (oldLine === newLine && oldIndex < oldLines.length && newIndex < newLines.length) {
      lines.push({ type: "unchanged", content: oldLine })
      oldIndex++
      newIndex++
      continue
    }

    if (newIndex >= newLines.length) {
      lines.push({ type: "removed", content: oldLine })
      oldIndex++
      continue
    }

    if (oldIndex >= oldLines.length) {
      lines.push({ type: "added", content: newLine })
      newIndex++
      continue
    }

    if (newLines[newIndex + 1] === oldLine) {
      lines.push({ type: "added", content: newLine })
      newIndex++
      continue
    }

    if (oldLines[oldIndex + 1] === newLine) {
      lines.push({ type: "removed", content: oldLine })
      oldIndex++
      continue
    }

    lines.push({ type: "removed", content: oldLine })
    lines.push({ type: "added", content: newLine })
    oldIndex++
    newIndex++
  }

  return lines
}

function getFrontierValue(frontier: Map<number, number>, diagonal: number): number {
  return frontier.get(diagonal) ?? -1
}

function backtrackMyers(
  trace: Array<Map<number, number>>,
  oldLines: string[],
  newLines: string[],
): DiffLine[] {
  const reversed: DiffLine[] = []
  let oldIndex = oldLines.length
  let newIndex = newLines.length

  for (let distance = trace.length - 1; distance >= 0; distance--) {
    const frontier = trace[distance]
    const diagonal = oldIndex - newIndex
    const previousDiagonal = (
      diagonal === -distance ||
      (
        diagonal !== distance &&
        getFrontierValue(frontier, diagonal - 1) <
          getFrontierValue(frontier, diagonal + 1)
      )
    )
      ? diagonal + 1
      : diagonal - 1

    const previousOldIndex = Math.max(0, getFrontierValue(frontier, previousDiagonal))
    const previousNewIndex = previousOldIndex - previousDiagonal

    while (oldIndex > previousOldIndex && newIndex > previousNewIndex) {
      reversed.push({
        type: "unchanged",
        content: oldLines[oldIndex - 1],
      })
      oldIndex--
      newIndex--
    }

    if (distance === 0) break

    if (oldIndex === previousOldIndex) {
      reversed.push({
        type: "added",
        content: newLines[newIndex - 1],
      })
      newIndex--
    } else {
      reversed.push({
        type: "removed",
        content: oldLines[oldIndex - 1],
      })
      oldIndex--
    }
  }

  return reversed.reverse()
}

function preciseLineDiff(
  oldLines: string[],
  newLines: string[],
  options: DiffLimits,
): { lines: DiffLine[] | null; fallbackReason: DiffFallbackReason | null } {
  const maxDistance = oldLines.length + newLines.length
  const frontier = new Map<number, number>([[1, 0]])
  const trace: Array<Map<number, number>> = []
  let operations = 0
  let traceEntries = 0

  for (let distance = 0; distance <= maxDistance; distance++) {
    traceEntries += frontier.size
    if (traceEntries > options.maxTraceEntries) {
      return { lines: null, fallbackReason: "trace-limit" }
    }
    trace.push(new Map(frontier))

    for (let diagonal = -distance; diagonal <= distance; diagonal += 2) {
      operations++
      if (operations > options.maxOperations) {
        return { lines: null, fallbackReason: "work-limit" }
      }

      let oldIndex: number
      if (
        diagonal === -distance ||
        (
          diagonal !== distance &&
          getFrontierValue(frontier, diagonal - 1) <
            getFrontierValue(frontier, diagonal + 1)
        )
      ) {
        oldIndex = getFrontierValue(frontier, diagonal + 1)
      } else {
        oldIndex = getFrontierValue(frontier, diagonal - 1) + 1
      }

      let newIndex = oldIndex - diagonal
      while (
        oldIndex < oldLines.length &&
        newIndex < newLines.length &&
        oldLines[oldIndex] === newLines[newIndex]
      ) {
        oldIndex++
        newIndex++
        operations++
        if (operations > options.maxOperations) {
          return { lines: null, fallbackReason: "work-limit" }
        }
      }

      frontier.set(diagonal, oldIndex)
      if (oldIndex >= oldLines.length && newIndex >= newLines.length) {
        return {
          lines: backtrackMyers(trace, oldLines, newLines),
          fallbackReason: null,
        }
      }
    }
  }

  return { lines: null, fallbackReason: "work-limit" }
}

function normalizeWhitespace(line: string): string {
  return line.trim().replace(/\s+/g, " ")
}

/** 按归一化后的行算出的差异换回原文：相同的行显示新文本里的写法 */
function restoreContents(lines: DiffLine[], oldLines: string[], newLines: string[]): DiffLine[] {
  let oldIndex = 0
  let newIndex = 0
  return lines.map((line) => {
    if (line.type === "removed") return { type: "removed", content: oldLines[oldIndex++] }
    if (line.type === "added") return { type: "added", content: newLines[newIndex++] }
    oldIndex++
    return { type: "unchanged", content: newLines[newIndex++] }
  })
}

export function computeLineDiff(
  oldText: string,
  newText: string,
  mode: DiffMode = "precise",
  options: DiffOptions = {},
): DiffResult {
  if (options.ignoreWhitespace) {
    const oldLines = splitLines(oldText)
    const newLines = splitLines(newText)
    const result = computeLineDiff(
      oldLines.map(normalizeWhitespace).join("\n"),
      newLines.map(normalizeWhitespace).join("\n"),
      mode,
      { ...options, ignoreWhitespace: false },
    )
    return { ...result, lines: restoreContents(result.lines, oldLines, newLines) }
  }

  if (mode === "quick") {
    return summarize(quickLineDiff(oldText, newText), "quick", null)
  }

  const oldLines = splitLines(oldText)
  const newLines = splitLines(newText)

  if (oldText === newText) {
    return summarize(
      oldLines.map((content) => ({ type: "unchanged" as const, content })),
      "myers",
      null,
    )
  }

  const resolvedOptions: DiffLimits = {
    maxPreciseLines: options.maxPreciseLines ?? DEFAULT_MAX_PRECISE_LINES,
    maxOperations: options.maxOperations ?? DEFAULT_MAX_OPERATIONS,
    maxTraceEntries: options.maxTraceEntries ?? DEFAULT_MAX_TRACE_ENTRIES,
  }

  if (oldLines.length + newLines.length > resolvedOptions.maxPreciseLines) {
    return summarize(quickLineDiff(oldText, newText), "quick", "line-limit")
  }

  const precise = preciseLineDiff(oldLines, newLines, resolvedOptions)
  if (!precise.lines) {
    return summarize(
      quickLineDiff(oldText, newText),
      "quick",
      precise.fallbackReason,
    )
  }

  return summarize(precise.lines, "myers", null)
}

/** 每一行在原文和新文本里的行号（从 1 开始）；新增的行没有原文行号，删除的行没有新行号 */
export function diffLineNumbers(lines: DiffLine[]): Array<{ old: number | null; new: number | null }> {
  let oldLine = 0
  let newLine = 0
  return lines.map((line) => (
    line.type === "added" ? { old: null, new: ++newLine }
      : line.type === "removed" ? { old: ++oldLine, new: null }
        : { old: ++oldLine, new: ++newLine }
  ))
}

/** 每一处改动（连续的新增、删除）从第几行开始，用于上一处、下一处跳转 */
export function diffChangeStarts(lines: DiffLine[]): number[] {
  const starts: number[] = []
  lines.forEach((line, index) => {
    if (line.type !== "unchanged" && (index === 0 || lines[index - 1].type === "unchanged")) starts.push(index)
  })
  return starts
}

/** 标准的 unified diff（默认 3 行上下文），可以交给 git apply、patch 或代码评审工具；没有差异时返回空串 */
export function unifiedDiff(
  lines: DiffLine[],
  { oldName = "original", newName = "modified", context = 3 }: { oldName?: string; newName?: string; context?: number } = {},
): string {
  const changed = (index: number) => lines[index].type !== "unchanged"
  const output = [`--- ${oldName}`, `+++ ${newName}`]
  let oldBefore = 0
  let newBefore = 0
  let position = 0

  for (;;) {
    let first = position
    while (first < lines.length && !changed(first)) first++
    if (first >= lines.length) break

    const start = Math.max(position, first - context)
    oldBefore += start - position
    newBefore += start - position

    // 两处改动之间的相同行不超过两倍上下文时并进同一段
    let end = first
    for (;;) {
      while (end < lines.length && changed(end)) end++
      let next = end
      while (next < lines.length && !changed(next)) next++
      if (next >= lines.length || next - end > context * 2) {
        end = Math.min(lines.length, end + context)
        break
      }
      end = next
    }

    let oldCount = 0
    let newCount = 0
    const body: string[] = []
    for (let index = start; index < end; index++) {
      const line = lines[index]
      if (line.type !== "added") oldCount++
      if (line.type !== "removed") newCount++
      body.push(`${line.type === "added" ? "+" : line.type === "removed" ? "-" : " "}${line.content}`)
    }
    output.push(`@@ -${oldCount ? oldBefore + 1 : oldBefore},${oldCount} +${newCount ? newBefore + 1 : newBefore},${newCount} @@`, ...body)
    oldBefore += oldCount
    newBefore += newCount
    position = end
  }

  return output.length > 2 ? `${output.join("\n")}\n` : ""
}
