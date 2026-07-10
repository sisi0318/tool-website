import { describe, expect, it } from "vitest"
import { createHexdump, detectFileSignature, processHexBinary } from "./hex-binary-tools"

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
