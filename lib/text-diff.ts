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
}

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
  options: Required<DiffOptions>,
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

export function computeLineDiff(
  oldText: string,
  newText: string,
  mode: DiffMode = "precise",
  options: DiffOptions = {},
): DiffResult {
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

  const resolvedOptions: Required<DiffOptions> = {
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
