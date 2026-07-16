export function haveEqualToolParams(
  current?: Record<string, string>,
  next?: Record<string, string>,
): boolean {
  const currentEntries = Object.entries(current ?? {}).sort(([left], [right]) => left.localeCompare(right))
  const nextEntries = Object.entries(next ?? {}).sort(([left], [right]) => left.localeCompare(right))

  return (
    currentEntries.length === nextEntries.length &&
    currentEntries.every(([key, value], index) => {
      const nextEntry = nextEntries[index]
      return nextEntry?.[0] === key && nextEntry[1] === value
    })
  )
}

export function uniqueToolIds(toolIds: string[]): string[] {
  return Array.from(new Set(toolIds))
}
