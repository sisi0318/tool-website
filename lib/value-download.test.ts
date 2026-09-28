import { beforeEach, describe, expect, it, vi } from "vitest"
import { canDownloadValue, downloadValue, isOpaqueValue } from "./value-download"

const download = vi.hoisted(() => vi.fn())
vi.mock("@/lib/object-url", () => ({ downloadBlob: download }))

beforeEach(() => download.mockClear())

describe("downloadValue", () => {
  it("names downloads after the value type and keeps file names", () => {
    const file = new File(["x"], "scan.pdf", { type: "application/pdf" })
    downloadValue(file, "node")
    downloadValue(new Uint8Array([1, 2, 3]), "node")
    downloadValue("plain text", "node")
    downloadValue({ a: 1 }, "node")
    expect(download.mock.calls.map(([blob, name]) => [(blob as Blob).type, name])).toEqual([
      ["application/pdf", "scan.pdf"],
      ["application/octet-stream", "node.bin"],
      ["text/plain;charset=utf-8", "node.txt"],
      ["application/json", "node.json"],
    ])
  })

  it("knows which values are files and which have nothing to download", () => {
    expect(isOpaqueValue(new Blob(["x"]))).toBe(true)
    expect(isOpaqueValue(new ArrayBuffer(2))).toBe(true)
    expect(isOpaqueValue("text")).toBe(false)
    expect([undefined, null, ""].map(canDownloadValue)).toEqual([false, false, false])
    expect(canDownloadValue(0)).toBe(true)
  })
})
