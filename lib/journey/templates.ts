import type { JourneyStep, SharedJourneyPath } from "./types"
import { OCR_LIMITS, checkOcrDimensions, ocrImageHeader } from "../ocr-shared"

export interface JourneyTemplate { id: string; input: "text" | "image"; sampleText?: string; maxChars?: number; steps: JourneyStep[] }
const fileStep = (filename: string): JourneyStep => ({ tool: "string-to-file", config: { filename }, outputPort: "file" })
export const JOURNEY_TEMPLATES: readonly JourneyTemplate[] = [
  { id: "scan-text", input: "image", steps: [{ tool: "ocr", config: { rotation: 0, enhanceSmallText: true }, outputPort: "text" }, { tool: "text-lines", config: { operation: "clean", trim: true, removeEmpty: true }, outputPort: "output" }, fileStep("recognized-text.txt")] },
  { id: "web-image", input: "image", steps: [{ tool: "image-convert", config: { format: "webp", quality: 82, maxWidth: 1600, maxHeight: 1600 }, outputPort: "file" }, { tool: "image-to-base64", config: { outputFormat: "dataUrl" }, outputPort: "dataUri" }, fileStep("image-data-url.txt")] },
  { id: "clean-list", input: "text", maxChars: 20_000, sampleText: "  café\n cafe\u0301 \n\napple\napple\n  橙子  \n", steps: [{ tool: "unicode", config: { operation: "NFC" }, outputPort: "output" }, { tool: "text-lines", config: { operation: "clean", trim: true, removeEmpty: true }, outputPort: "output" }, { tool: "text-lines", config: { operation: "dedupe", trim: false, ignoreCase: false, removeEmpty: true }, outputPort: "output" }, fileStep("clean-list.txt")] },
  { id: "csv-json", input: "text", maxChars: 1_000_000, sampleText: "编号,名称,数量\n00123,键盘,12\n00456,鼠标,8", steps: [{ tool: "csv", config: { operation: "to-json", header: true, delimiter: "", dynamicTyping: false, strict: true }, outputPort: "output" }, { tool: "json-format", config: { indent: 2, sortKeys: false }, outputPort: "formatted" }, fileStep("records.json")] },
  { id: "base64-json", input: "text", maxChars: 1_000_000, sampleText: "eyJuYW1lIjoiQWRhIiwicm9sZXMiOlsiZGV2IiwiYWRtaW4iXX0=", steps: [{ tool: "encoding", config: { encoding: "base64", mode: "decode" }, outputPort: "output" }, { tool: "json-format", config: { indent: 2, sortKeys: false }, outputPort: "formatted" }, fileStep("decoded.json")] },
  { id: "json-yaml", input: "text", maxChars: 1_000_000, sampleText: '{"name":"tool-station","port":3000,"features":["ocr","local-tools"],"enabled":true}', steps: [{ tool: "json-to-yaml", config: {}, outputPort: "yaml" }, fileStep("config.yaml")] },
]
export function getJourneyTemplate(id: string) { return JOURNEY_TEMPLATES.find(template => template.id === id) }
export function journeyTemplatePath(template: JourneyTemplate, name: string): SharedJourneyPath {
  return { v: 1, name, steps: template.steps.map(step => ({ ...step, config: { ...step.config } })), ...(template.sampleText ? { rootText: template.sampleText } : {}) }
}
export function templateIdFromHash(hash: string) { const id = new URLSearchParams(hash.replace(/^#/, "")).get("template"); return id && getJourneyTemplate(id) ? id : null }
export async function validateTemplateImage(file: File) {
  if (!file.size || file.size > OCR_LIMITS.fileBytes) throw new Error("imageLimit")
  const header = ocrImageHeader(new Uint8Array(await file.arrayBuffer())); checkOcrDimensions(header.width, header.height)
}
