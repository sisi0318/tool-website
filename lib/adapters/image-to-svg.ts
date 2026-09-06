import { PenTool } from "lucide-react"
import { asFile } from "../canvas/persist"
import { registerNode } from "../canvas/registry"
import { DEFAULT_VECTOR_OPTIONS, ImageVectorError, vectorOptions, type ImageVectorOptions } from "../image-vector-shared"
import type { ToolAdapter } from "./types"

export const imageToSvgAdapter: ToolAdapter = {
  type: "image-to-svg", category: "image", label: "Image to SVG", icon: PenTool,
  description: "Trace PNG, JPEG or WebP locally into SVG paths with faithful or smooth contours",
  config: [
    { id: "file", name: "Image file", dataType: "bytes", hasInput: true },
    { id: "tracing", name: "Tracing", dataType: "string", defaultValue: DEFAULT_VECTOR_OPTIONS.tracing, options: [{ label: "Pixel faithful", value: "faithful" }, { label: "Smooth contours", value: "smooth" }] },
    { id: "mode", name: "Color mode", dataType: "string", defaultValue: "color", options: [{ label: "Color", value: "color" }, { label: "Black and white", value: "monochrome" }] },
    { id: "maxEdge", name: "Tracing maximum edge", dataType: "number", defaultValue: 1024, options: [512, 768, 1024, 1600, 2048].map(value => ({ label: `${value} px`, value: String(value) })) },
    { id: "colorPrecision", name: "Color precision", dataType: "string", defaultValue: "fine", options: [{ label: "Fine", value: "fine" }, { label: "Standard", value: "balanced" }, { label: "Fewer colors", value: "simple" }] },
    { id: "detail", name: "Contour detail", dataType: "string", defaultValue: "high", visible: config => config.tracing === "smooth", options: [{ label: "High", value: "high" }, { label: "Balanced", value: "balanced" }, { label: "Simple", value: "simple" }] },
    { id: "alpha", name: "Background", dataType: "string", defaultValue: "transparent", options: [{ label: "Retain transparent areas", value: "transparent" }, { label: "Composite on white", value: "white" }] },
    { id: "threshold", name: "Black and white threshold (0–255)", dataType: "number", defaultValue: 160, visible: config => config.mode === "monochrome" },
  ],
  outputs: [{ id: "file", name: "SVG file", dataType: "bytes" }, { id: "svg", name: "SVG source", dataType: "string" }, { id: "info", name: "Details", dataType: "json" }],
  async execute(inputs, config, context) {
    const file = asFile(inputs.file ?? config.file)
    if (!file) throw new ImageVectorError("format")
    const options = vectorOptions({ tracing: String(config.tracing ?? "faithful") as ImageVectorOptions["tracing"], mode: String(config.mode ?? "color") as ImageVectorOptions["mode"], detail: String(config.detail ?? "high") as ImageVectorOptions["detail"], colorPrecision: String(config.colorPrecision ?? "fine") as ImageVectorOptions["colorPrecision"], maxEdge: Number(config.maxEdge ?? 1024), alpha: String(config.alpha ?? "transparent") as ImageVectorOptions["alpha"], threshold: Number(config.threshold ?? 160) })
    const { vectorizeImage } = await import("../image-vector-worker-client")
    const result = await vectorizeImage(file, options, { signal: context?.signal })
    return { file: result.file, svg: result.svg, info: result.info }
  },
}
export function registerImageToSvgAdapter() { registerNode(imageToSvgAdapter) }
