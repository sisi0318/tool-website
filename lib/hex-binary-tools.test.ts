import { describe, expect, it } from "vitest"
import { createHexdump, detectFileSignature, HEX_PREVIEW_BYTES, hexBinaryOutputBlob, processHexBinary, processHexBinaryBytes } from "./hex-binary-tools"
import { encodeBinaryOutput } from "./compression"

describe("hex and binary tools", () => {
  it("renders offsets, hex bytes, and ASCII", () => {
    expect(createHexdump(new TextEncoder().encode("Hello"))).toContain("00000000  48 65 6c 6c 6f")
    expect(createHexdump(new TextEncoder().encode("Hello"))).toContain("|Hello")
  })

  it("recognizes common file signatures", () => {
    expect(detectFileSignature(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toMatchObject({ name: "PNG image", extension: ".png" })
  })

  it("converts between text and hex", () => {
    expect(processHexBinary("Hello", "to-hex", "text").output).toBe("48656c6c6f")
    expect(processHexBinary("48656c6c6f", "to-text", "hex").output).toBe("Hello")
  })
})

function blobText(blob: Blob) {
  return new Promise<string>((resolve) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result as string); reader.readAsText(blob) })
}

describe("large binary inputs", () => {
  const bytes = Uint8Array.from({ length: HEX_PREVIEW_BYTES * 3 + 5 }, (_, index) => (index * 31) % 256)

  it("keeps only a bounded preview in the output box", () => {
    const result = processHexBinaryBytes(bytes, "hexdump")
    expect(result.truncated).toBe(true)
    expect(result.byteLength).toBe(bytes.byteLength)
    expect(result.output.split("\n")).toHaveLength(HEX_PREVIEW_BYTES / 16)
    expect(processHexBinaryBytes(bytes.subarray(0, 32), "to-hex")).toMatchObject({ truncated: false, output: encodeBinaryOutput(bytes.subarray(0, 32), "hex") })
  })

  it("builds the full download in chunks that match a one-shot conversion", async () => {
    expect(await blobText(hexBinaryOutputBlob(bytes, "hexdump", 16))).toBe(createHexdump(bytes, 16))
    expect(await blobText(hexBinaryOutputBlob(bytes, "to-base64"))).toBe(encodeBinaryOutput(bytes, "base64"))
    expect(await blobText(hexBinaryOutputBlob(bytes, "to-hex"))).toBe(encodeBinaryOutput(bytes, "hex"))
  })
})
