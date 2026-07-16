export interface RegexHighlightMatch {
  index: number
  length: number
  match: string
}

export type RegexHighlightSegment =
  | { type: "text"; text: string }
  | {
      type: "match"
      text: string
      matchIndex: number
      start: number
    }

export function buildRegexHighlightSegments(
  text: string,
  matches: RegexHighlightMatch[],
): RegexHighlightSegment[] {
  if (!text || matches.length === 0) {
    return [{ type: "text", text }]
  }

  const segments: RegexHighlightSegment[] = []
  let cursor = 0
  const orderedMatches = matches
    .map((match, matchIndex) => ({ match, matchIndex }))
    .sort((left, right) => left.match.index - right.match.index)

  for (const { match, matchIndex } of orderedMatches) {
    const start = Math.max(0, match.index)
    const end = Math.min(text.length, start + Math.max(0, match.length))

    if (start < cursor || start > text.length || end < start) continue
    if (start > cursor) {
      segments.push({ type: "text", text: text.slice(cursor, start) })
    }

    segments.push({
      type: "match",
      text: text.slice(start, end),
      matchIndex,
      start,
    })
    cursor = end
  }

  if (cursor < text.length) {
    segments.push({ type: "text", text: text.slice(cursor) })
  }

  return segments.length > 0 ? segments : [{ type: "text", text }]
}
