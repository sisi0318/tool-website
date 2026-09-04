import { Scissors } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"
import { asFile } from "../canvas/persist"
import { createMemeGrid, safeMemeFileBase } from "../meme-grid-tools"

const MAX_PIXELS = 64_000_000 // 约 8000×8000，防止画布内存爆掉

export const memeSplitterAdapter: ToolAdapter = {
  type: "meme-splitter",
  category: "image",
  label: "Meme Splitter",
  icon: Scissors,
  config: [
    {
      id: "file",
      name: "File",
      dataType: "bytes",
      hasInput: true,
      hasOutput: false,
    },
    {
      id: "rows",
      name: "Rows",
      dataType: "number",
      defaultValue: 4,
      slider: { min: 1, max: 10, step: 1 },
      hasInput: true,
      hasOutput: true,
    },
    {
      id: "cols",
      name: "Cols",
      dataType: "number",
      defaultValue: 6,
      slider: { min: 1, max: 10, step: 1 },
      hasInput: true,
      hasOutput: true,
    },
  ],
  outputs: [
    { id: "zip", name: "ZIP", dataType: "bytes" },
    { id: "parts", name: "Parts", dataType: "json" },
  ],
  async execute(inputs, config) {
    const file = asFile(inputs.file ?? config.file)
    if (!file || !(file instanceof Blob)) {
      throw new Error("No file provided")
    }

    const rows = Number(inputs.rows ?? config.rows ?? 4)
    const cols = Number(inputs.cols ?? config.cols ?? 6)

    const bitmap = await createImageBitmap(file)
    try {
      if (bitmap.width * bitmap.height > MAX_PIXELS) {
        throw new Error("Image is too large to split (max ~64MP)")
      }

      const grid = createMemeGrid(
        { left: 0, top: 0, width: bitmap.width, height: bitmap.height },
        rows,
        cols,
        bitmap.width,
        bitmap.height,
      )

      const { default: JSZip } = await import("jszip")
      const zip = new JSZip()
      const base = safeMemeFileBase(file.name)

      for (const cell of grid.cells) {
        const canvas = new OffscreenCanvas(cell.width, cell.height)
        const ctx = canvas.getContext("2d")
        if (!ctx) throw new Error("Canvas 2D context unavailable")
        ctx.drawImage(
          bitmap,
          cell.x,
          cell.y,
          cell.width,
          cell.height,
          0,
          0,
          cell.width,
          cell.height,
        )
        const blob = await canvas.convertToBlob({ type: "image/png" })
        zip.file(`${base}-${String(cell.index + 1).padStart(2, "0")}.png`, blob)
      }

      const zipBlob = await zip.generateAsync({ type: "blob" })
      const zipFile = new File([zipBlob], `${base}-grid.zip`, { type: "application/zip" })

      return {
        zip: zipFile,
        parts: {
          fileName: file.name,
          rows,
          cols,
          count: grid.cells.length,
          width: bitmap.width,
          height: bitmap.height,
        },
      }
    } finally {
      bitmap.close()
    }
  },
}

export function registerMemeSplitterAdapter(): void {
  registerNode(memeSplitterAdapter)
}
