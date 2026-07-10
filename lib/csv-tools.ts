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

  const parsed = Papa.parse<Record<string, unknown> | unknown[]>(input, {
    header: options.header !== false,
    delimiter: options.delimiter || "",
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
      delimiter: operation === "to-tsv" ? "\t" : options.delimiter || parsed.meta.delimiter || ",",
      header: options.header !== false,
    })
  }

  return {
    output,
    rows: data.length,
    columns,
    delimiter: parsed.meta.delimiter || options.delimiter || ",",
    preview: data.slice(0, 20),
    errors,
  }
}

