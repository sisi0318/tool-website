import { OCR_LIMITS, OcrError, checkOcrDimensions, ocrImageHeader } from "../lib/ocr-shared"
import { detectTableRules, tableCsv, validateTableCells, type TableRequest, type TableResponse } from "../lib/image-table-shared"
import { tableXlsx } from "../lib/image-table-export"

const scope = self as unknown as { onmessage: ((event: MessageEvent<TableRequest>) => void) | null; postMessage(value: unknown): void }
scope.onmessage = async ({ data }) => {
  let bitmap: ImageBitmap | undefined, canvas: OffscreenCanvas | undefined
  try {
    let result: TableResponse
    if (data.action === "prepare") {
      if (!data.file?.size || data.file.size > OCR_LIMITS.fileBytes) throw new OcrError("fileLimit")
      const header = ocrImageHeader(new Uint8Array(await data.file.arrayBuffer())); checkOcrDimensions(header.width, header.height)
      try { bitmap = await createImageBitmap(data.file, { imageOrientation: "from-image" }) } catch { throw new OcrError("decode") }
      const { width, height } = bitmap; checkOcrDimensions(width, height)
      const scale = Math.min(1, 1600 / Math.max(width, height))
      canvas = new OffscreenCanvas(Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale)))
      const ctx = canvas.getContext("2d", { willReadFrequently: true }); if (!ctx) throw new OcrError("unsupported")
      ctx.fillStyle = "white"; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      const rules = detectTableRules(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height)
      rules.x = rules.x.map(x => Math.round(x * width / canvas!.width)); rules.y = rules.y.map(y => Math.round(y * height / canvas!.height))
      result = { image: { width, height, animated: header.animated, rules, preview: await canvas.convertToBlob({ type: "image/png" }) } }
    } else if (data.action === "export") {
      validateTableCells(data.cells)
      if (data.format === "csv") result = { output: new Blob([tableCsv(data.cells, data.safeCsv)], { type: "text/csv;charset=utf-8" }) }
      else if (data.format === "xlsx") {
        result = { output: new Blob([await tableXlsx(data.cells, data.numbers)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }) }
      } else throw new OcrError("options")
    } else throw new OcrError("options")
    scope.postMessage({ result })
  } catch (error) { scope.postMessage({ error: error instanceof OcrError ? error.code : "engine" }) }
  finally { bitmap?.close(); if (canvas) canvas.width = canvas.height = 1 }
}
scope.postMessage({ ready: true })
