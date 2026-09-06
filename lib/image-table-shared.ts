import { lineBounds, OcrError, type OcrLine } from "./ocr-shared"

export const TABLE_LIMITS = { rows: 200, columns: 40, cells: 2000, cellChars: 32767, textChars: 2_000_000, timeout: 60_000 } as const
export interface TableGrid { x: number[]; y: number[] }
export interface TableImage { width: number; height: number; animated: boolean; preview: Blob; rules: TableGrid }
export interface TableCell { text: string; review: boolean }
export interface TableData { cells: TableCell[][]; outside: number; uncertain: number }
export type TableRequest = { action: "prepare"; file: File } | { action: "export"; cells: string[][]; format: "csv" | "xlsx"; numbers: boolean; safeCsv: boolean }
export type TableResponse = { image: TableImage } | { output: Blob }

export function tableGrid(grid: TableGrid, width: number, height: number): TableGrid {
  for (const [values, end, limit] of [[grid.x, width, TABLE_LIMITS.columns], [grid.y, height, TABLE_LIMITS.rows]] as const) {
    if (!Array.isArray(values) || values.length < 2 || values.length > limit + 1 || values.some((v, i) => !Number.isFinite(v) || v < 0 || v > end || (i > 0 && v - values[i - 1] < 2))) throw new OcrError("options")
  }
  if ((grid.x.length - 1) * (grid.y.length - 1) > TABLE_LIMITS.cells) throw new OcrError("outputLimit")
  return { x: [...grid.x], y: [...grid.y] }
}

/** Long, continuous dark strokes are table-rule candidates; text alignment is the fallback. */
export function detectTableRules(rgba: Uint8ClampedArray, width: number, height: number): TableGrid {
  const dark = (x: number, y: number) => { const p = (y * width + x) * 4, a = rgba[p + 3] / 255; return (rgba[p] * 0.299 + rgba[p + 1] * 0.587 + rgba[p + 2] * 0.114) * a + 255 * (1 - a) < 170 }
  const scan = (vertical: boolean) => {
    const outer = vertical ? width : height, inner = vertical ? height : width, hits: number[][] = []
    for (let a = 0; a < outer; a++) {
      let longest = 0, run = 0, gap = 0
      for (let b = 0; b < inner; b++) {
        if (dark(vertical ? a : b, vertical ? b : a)) { run++; gap = 0; longest = Math.max(longest, run) }
        else if (run && gap < 1) { run++; gap++ } else { run = 0; gap = 0 }
      }
      if (longest >= Math.max(60, inner * 0.35)) {
        const last = hits.at(-1)
        if (last && a - last.at(-1)! <= 2) last.push(a); else hits.push([a])
      }
    }
    return hits.filter(group => group.length <= Math.max(10, outer * 0.015)).map(group => Math.round((group[0] + group.at(-1)!) / 2))
  }
  return { x: scan(true), y: scan(false) }
}

export function inferTableGrid(lines: OcrLine[], width: number, height: number, rules: TableGrid): TableGrid {
  const boxes = lines.map(line => lineBounds(line.poly)), heights = boxes.map(b => b.bottom - b.top).sort((a, b) => a - b)
  const textHeight = heights[Math.floor(heights.length / 2)] || 24
  const clusters = (positions: number[], tolerance: number) => {
    const groups: number[][] = []
    for (const position of positions.sort((a, b) => a - b)) { const group = groups.at(-1); if (group && position - group[0] <= tolerance) group.push(position); else groups.push([position]) }
    return groups.map(group => group.reduce((a, b) => a + b, 0) / group.length)
  }
  const rows = clusters(boxes.map(b => (b.top + b.bottom) / 2), textHeight * 0.6)
  const starts = clusters(boxes.map(b => b.left), textHeight * 1.5)
  const columns = starts.map((left, i) => {
    const right = Math.max(left + 2, ...boxes.filter(b => Math.abs(b.left - left) <= textHeight * 1.5 && (i === starts.length - 1 || b.right < starts[i + 1])).map(b => b.right))
    return { left, right }
  })
  const x = rules.x.length >= 2 ? rules.x : columns.length ? [Math.max(0, Math.floor(columns[0].left - textHeight / 2)), ...columns.slice(1).map((col, i) => Math.round((columns[i].right + col.left) / 2)), Math.min(width, Math.ceil(Math.max(...boxes.map(b => b.right)) + textHeight / 2))] : [0, width]
  const y = rules.y.length >= 2 ? rules.y : rows.length ? [Math.max(0, Math.floor(rows[0] - textHeight)), ...rows.slice(1).map((row, i) => Math.round((rows[i] + row) / 2)), Math.min(height, Math.ceil(rows.at(-1)! + textHeight))] : [0, height]
  return tableGrid({ x, y }, width, height)
}

export function populateTable(lines: OcrLine[], grid: TableGrid): TableData {
  const buckets: OcrLine[][][] = Array.from({ length: grid.y.length - 1 }, () => Array.from({ length: grid.x.length - 1 }, () => []))
  let outside = 0, uncertain = 0
  const cellIndex = (edges: number[], center: number) => center < edges[0] || center >= edges.at(-1)! ? -1 : edges.findIndex((edge, i) => i > 0 && center < edge) - 1
  for (const line of lines) { const b = lineBounds(line.poly), col = cellIndex(grid.x, (b.left + b.right) / 2), row = cellIndex(grid.y, (b.top + b.bottom) / 2); if (col < 0 || row < 0) outside++; else buckets[row][col].push(line) }
  const cells = buckets.map((row, r) => row.map((items, c) => {
    const review = items.some(line => { const b = lineBounds(line.poly); return line.score < 0.9 || b.left < grid.x[c] - 2 || b.right > grid.x[c + 1] + 2 || b.top < grid.y[r] - 2 || b.bottom > grid.y[r + 1] + 2 })
    if (review) uncertain++
    // OCR lines in the same physical row are separated with spaces; wrapped rows stay multiline.
    const ordered = [...items].sort((a, b) => lineBounds(a.poly).top - lineBounds(b.poly).top || lineBounds(a.poly).left - lineBounds(b.poly).left)
    let text = "", previous: ReturnType<typeof lineBounds> | undefined
    for (const line of ordered) { const b = lineBounds(line.poly), sameRow = previous && Math.min(previous.bottom, b.bottom) - Math.max(previous.top, b.top) > Math.min(previous.bottom - previous.top, b.bottom - b.top) / 2; text += (text ? sameRow ? " " : "\n" : "") + line.text; previous = b }
    return { text, review }
  }))
  validateTableCells(cells.map(row => row.map(cell => cell.text)))
  return { cells, outside, uncertain }
}

export function validateTableCells(cells: string[][]) {
  if (!Array.isArray(cells) || !cells.length || cells.length > TABLE_LIMITS.rows || !Array.isArray(cells[0]) || !cells[0].length || cells[0].length > TABLE_LIMITS.columns || cells.length * cells[0].length > TABLE_LIMITS.cells) throw new OcrError("outputLimit")
  let total = 0
  for (const row of cells) { if (!Array.isArray(row) || row.length !== cells[0].length) throw new OcrError("options"); for (const text of row) { if (typeof text !== "string" || text.length > TABLE_LIMITS.cellChars) throw new OcrError("outputLimit"); total += text.length } }
  if (total > TABLE_LIMITS.textChars) throw new OcrError("outputLimit")
}
export function tableCsv(cells: string[][], safe = true) {
  validateTableCells(cells)
  return "\ufeff" + cells.map(row => row.map(text => `"${(safe && /^[\s\u0000-\u001f]*[=+\-@]/.test(text) ? "'" + text : text).replace(/"/g, '""')}"`).join(",")).join("\r\n") + "\r\n"
}
export function tableCellValue(text: string, numbers: boolean): string | number {
  if (!numbers || !/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(text) || text.replace(/[-.]/g, "").length > 15 || Object.is(Number(text), -0)) return text
  return Number.isFinite(Number(text)) ? Number(text) : text
}
export function tableColumnName(index: number) { let name = ""; for (let value = index + 1; value; value = Math.floor((value - 1) / 26)) name = String.fromCharCode(65 + (value - 1) % 26) + name; return name }
