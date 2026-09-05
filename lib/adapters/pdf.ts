import { FileText, Images } from "lucide-react"
import { registerNode } from "../canvas/registry"
import { asFile } from "../canvas/persist"
import type { ToolAdapter } from "./types"
import type { PdfImageOptions, PdfNumbering } from "../pdf-shared"

const outputPorts: ToolAdapter["outputs"] = [{ id: "file", name: "PDF / ZIP file", dataType: "bytes" }, { id: "info", name: "Details", dataType: "json" }, { id: "pages", name: "Pages", dataType: "number" }]
export const pdfAdapter: ToolAdapter = {
  type: "pdf", category: "data", label: "PDF Pages", icon: FileText,
  description: "Inspect, merge, select, reorder, rotate, split and number PDF pages locally",
  config: [
    { id: "file", name: "PDF file", dataType: "bytes", hasInput: true },
    { id: "additionalFile", name: "Additional PDF (optional)", dataType: "bytes", hasInput: true },
    { id: "operation", name: "Operation", dataType: "string", defaultValue: "inspect", options: [{ label: "Inspect", value: "inspect" }, { label: "Process / merge pages", value: "process" }, { label: "Split", value: "split" }] },
    { id: "selection", name: "Page order (1-based, e.g. 3,1-2; empty = all)", dataType: "string", defaultValue: "", visible: (config) => config.operation !== "inspect" },
    { id: "rotation", name: "Added clockwise rotation", dataType: "number", defaultValue: 0, options: [{ label: "0°", value: "0" }, { label: "90°", value: "90" }, { label: "180°", value: "180" }, { label: "270°", value: "270" }], visible: (config) => config.operation !== "inspect" },
    { id: "splitEvery", name: "Pages per output PDF", dataType: "number", defaultValue: 1, visible: (config) => config.operation === "split" },
    { id: "numbering", name: "Add page numbers", dataType: "boolean", defaultValue: false, visible: (config) => config.operation !== "inspect" },
    { id: "numberPosition", name: "Number position", dataType: "string", defaultValue: "bottom-center", options: [{ label: "Bottom center", value: "bottom-center" }, { label: "Bottom right", value: "bottom-right" }, { label: "Top right", value: "top-right" }], visible: (config) => config.numbering === true },
    { id: "flattenForms", name: "Convert interactive forms to static content", dataType: "boolean", defaultValue: false, visible: (config) => config.operation !== "inspect" },
    { id: "allowSignatureChanges", name: "Allow rewriting signed PDFs (invalidates signatures)", dataType: "boolean", defaultValue: false, visible: (config) => config.operation !== "inspect" },
  ],
  outputs: outputPorts,
  async execute(inputs, config, context) {
    const { inspectPdfFiles, composePdfFiles } = await import("../pdf-worker-client")
    const { PdfToolError } = await import("../pdf-shared")
    const file = asFile(inputs.file ?? config.file), additional = asFile(inputs.additionalFile ?? config.additionalFile)
    if (!file) throw new PdfToolError("invalidPdf")
    const files = additional ? [file, additional] : [file], operation = String(config.operation ?? "inspect")
    if (operation === "inspect") { const info = await inspectPdfFiles(files, { signal: context?.signal }); return { file, info, pages: info.reduce((sum, document) => sum + document.pages.length, 0) } }
    if (!["process", "split"].includes(operation)) throw new PdfToolError("invalidOptions")
    const splitEvery = operation === "split" ? Number(config.splitEvery ?? 1) : 0
    if (operation === "split" && splitEvery < 1) throw new PdfToolError("invalidOptions")
    const result = await composePdfFiles(files, { selection: String(config.selection ?? ""), rotation: Number(config.rotation ?? 0), splitEvery, numbering: { enabled: config.numbering === true, position: String(config.numberPosition ?? "bottom-center") as PdfNumbering["position"] }, flattenForms: config.flattenForms === true, allowSignatureChanges: config.allowSignatureChanges === true }, { signal: context?.signal })
    return { file: result.download, pages: result.pages, info: { files: result.files.map((output) => ({ name: output.file.name, size: output.file.size, pages: output.pages })), retainedForms: result.retainedForms, flattenedForms: result.flattenedForms, droppedOutlines: result.droppedOutlines, changedSignatures: result.changedSignatures } }
  },
}
export const imagesToPdfAdapter: ToolAdapter = {
  type: "images-to-pdf", category: "image", label: "Images to PDF", icon: Images,
  description: "Create a PDF from PNG / JPEG files while preserving EXIF orientation",
  config: [
    { id: "file", name: "PNG / JPEG file", dataType: "bytes", hasInput: true },
    { id: "additionalFile", name: "Additional image (optional)", dataType: "bytes", hasInput: true },
    { id: "pageSize", name: "Page size", dataType: "string", defaultValue: "a4", options: [{ label: "A4 portrait", value: "a4" }, { label: "A4 landscape", value: "a4-landscape" }, { label: "Letter portrait", value: "letter" }, { label: "Letter landscape", value: "letter-landscape" }, { label: "Image size (96 DPI)", value: "image" }] },
    { id: "margin", name: "Margin (pt)", dataType: "number", defaultValue: 36 },
    { id: "numbering", name: "Add page numbers", dataType: "boolean", defaultValue: false },
  ],
  outputs: outputPorts,
  async execute(inputs, config, context) {
    const { imageFilesToPdf } = await import("../pdf-worker-client")
    const { PdfToolError } = await import("../pdf-shared")
    const file = asFile(inputs.file ?? config.file), additional = asFile(inputs.additionalFile ?? config.additionalFile)
    if (!file) throw new PdfToolError("invalidImage")
    const result = await imageFilesToPdf(additional ? [file, additional] : [file], { pageSize: String(config.pageSize ?? "a4") as PdfImageOptions["pageSize"], margin: Number(config.margin ?? 36), numbering: { enabled: config.numbering === true } }, { signal: context?.signal })
    return { file: result.download, pages: result.pages, info: { pages: result.pages, bytes: result.download.size } }
  },
}
export function registerPdfAdapters(): void { registerNode(pdfAdapter); registerNode(imagesToPdfAdapter) }
