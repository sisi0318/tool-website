import { formatCanvasValue } from "@/lib/canvas/format-value"
import { downloadBlob } from "@/lib/object-url"

function isBinary(value: unknown): value is ArrayBuffer | ArrayBufferView {
  return value instanceof ArrayBuffer || ArrayBuffer.isView(value)
}

/** 文件、二进制块这类只能下载、复制出来也只是“文件名 (大小)”的值 */
export function isOpaqueValue(value: unknown): boolean {
  return (typeof Blob !== "undefined" && value instanceof Blob) || isBinary(value)
}

export function canDownloadValue(value: unknown): boolean {
  return value !== undefined && value !== null && value !== ""
}

/**
 * 按值的类型下载：文件原样（沿用文件名）、二进制存成 .bin、文本存成 .txt、其余存成 .json。
 * 旅程的值卡片与画布的属性面板共用；画布以前只能复制，复制文件得到的只是“文件名 (大小)”。
 */
export function downloadValue(value: unknown, baseName: string) {
  if (typeof Blob !== "undefined" && value instanceof Blob) {
    downloadBlob(value, value instanceof File && value.name ? value.name : `${baseName}.bin`)
    return
  }
  if (isBinary(value)) {
    const bytes = value instanceof ArrayBuffer ? new Uint8Array(value) : new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
    downloadBlob(new Blob([bytes.slice()], { type: "application/octet-stream" }), `${baseName}.bin`)
    return
  }
  if (typeof value === "string") {
    downloadBlob(new Blob([value], { type: "text/plain;charset=utf-8" }), `${baseName}.txt`)
    return
  }
  downloadBlob(new Blob([formatCanvasValue(value, true)], { type: "application/json" }), `${baseName}.json`)
}
