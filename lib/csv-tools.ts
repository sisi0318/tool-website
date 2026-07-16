import Papa from "papaparse"

export type CsvOperation = "to-json" | "from-json" | "normalize" | "to-tsv"

export interface CsvOptions {
  delimiter?: string
  header?: boolean
  skipEmptyLines?: boolean
}

export interface CsvResult {
  output: string
  rows: number
  columns: string[]
  delimiter: string
  preview: Array<Record<string, unknown> | unknown[]>
  errors: string[]
}

function delimiterCountsOutsideQuotes(input: string, delimiter: string): number[] {
  const counts: number[] = []
  let count = 0
  let inQuotes = false

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index]
    if (character === '"') {
      if (inQuotes && input[index + 1] === '"') {
        index += 1
      } else {
        inQuotes = !inQuotes
      }
    } else if (!inQuotes && character === delimiter) {
      count += 1
    } else if (!inQuotes && (character === "\n" || character === "\r")) {
      if (character === "\r" && input[index + 1] === "\n") index += 1
      counts.push(count)
      count = 0
      if (counts.length >= 20) break
    }
  }

  if (counts.length < 20 && (count > 0 || input.trim())) counts.push(count)
  return counts
}

export function detectCsvDelimiter(input: string): string {
  const candidates = [",", "\t", ";", "|"]
  let bestDelimiter = ","
  let bestScore = -1

  for (const delimiter of candidates) {
    const positiveCounts = delimiterCountsOutsideQuotes(input, delimiter).filter((count) => count > 0)
    if (positiveCounts.length === 0) continue

    const frequencies = new Map<number, number>()
    for (const count of positiveCounts) frequencies.set(count, (frequencies.get(count) ?? 0) + 1)
    const [mode, consistentRows] = [...frequencies.entries()]
      .sort((left, right) => right[1] - left[1] || right[0] - left[0])[0]
    const score = consistentRows * 100 + mode

    if (score > bestScore) {
      bestScore = score
      bestDelimiter = delimiter
    }
  }

  return bestDelimiter
}

export function processCsv(input: string, operation: CsvOperation, options: CsvOptions = {}): CsvResult {
  if (operation === "from-json") {
    const parsed = JSON.parse(input)
    const rows = Array.isArray(parsed) ? parsed : [parsed]
    if (!rows.every((row) => row && typeof row === "object")) throw new Error("JSON must contain an object or array of objects")
    const output = Papa.unparse(rows, { delimiter: options.delimiter || ",", header: options.header !== false })
    const first = rows[0] as Record<string, unknown> | undefined
    return {
      output,
      rows: rows.length,
      columns: first && !Array.isArray(first) ? Object.keys(first) : [],
      delimiter: options.delimiter || ",",
      preview: rows.slice(0, 20),
      errors: [],
    }
  }

  const delimiter = options.delimiter || detectCsvDelimiter(input)
  const parsed = Papa.parse<Record<string, unknown> | unknown[]>(input, {
    header: options.header !== false,
    delimiter,
    skipEmptyLines: options.skipEmptyLines !== false ? "greedy" : false,
    dynamicTyping: true,
  })
  const errors = parsed.errors.map((error) => `Row ${error.row ?? "?"}: ${error.message}`)
  const data = parsed.data as Array<Record<string, unknown> | unknown[]>
  const columns = parsed.meta.fields ?? (Array.isArray(data[0]) ? data[0].map((_, index) => String(index + 1)) : [])
  let output: string

  if (operation === "to-json") {
    output = JSON.stringify(data, null, 2)
  } else {
    output = Papa.unparse(data as any, {
      delimiter: operation === "to-tsv" ? "\t" : delimiter,
      header: options.header !== false,
    })
  }

  return {
    output,
    rows: data.length,
    columns,
    delimiter,
    preview: data.slice(0, 20),
    errors,
  }
}
