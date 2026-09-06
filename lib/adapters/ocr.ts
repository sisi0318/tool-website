import { ScanText } from "lucide-react"
import { asFile } from "../canvas/persist"
import { registerNode } from "../canvas/registry"
import { OCR_LIMITS, OcrError, ocrOptions, type OcrOptions } from "../ocr-shared"
import type { ToolAdapter } from "./types"

export const ocrAdapter: ToolAdapter = {
  type: "ocr", category: "image", label: "OCR", icon: ScanText,
  executionTimeoutMs: OCR_LIMITS.timeout,
  description: "Recognize Chinese and English in local images with PaddleOCR",
  config: [
    { id: "file", name: "Image file", dataType: "bytes", hasInput: true },
    { id: "rotation", name: "Clockwise rotation", dataType: "number", defaultValue: 0, options: [0, 90, 180, 270].map(value => ({ label: `${value}°`, value: String(value) })) },
    { id: "enhanceSmallText", name: "Enhance small text", dataType: "boolean", defaultValue: true },
  ],
  outputs: [{ id: "text", name: "Recognized text", dataType: "string" }, { id: "lines", name: "Text boxes and confidence", dataType: "json" }, { id: "info", name: "Image details", dataType: "json" }],
  async execute(inputs, config, context) {
    const file = asFile(inputs.file ?? config.file)
    if (!file) throw new OcrError("format")
    const options = ocrOptions({ rotation: Number(config.rotation ?? 0) as OcrOptions["rotation"], enhanceSmallText: config.enhanceSmallText === undefined ? true : config.enhanceSmallText as boolean })
    const { recognizeImage } = await import("../ocr-worker-client")
    const result = await recognizeImage(file, options, { signal: context?.signal })
    return { text: result.text, lines: result.lines, info: result.info }
  },
}
export function registerOcrAdapter() { registerNode(ocrAdapter) }
