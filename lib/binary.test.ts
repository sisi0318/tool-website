import { describe, expect, it } from "vitest"

import { base64ToBytes, bytesToBase64, bytesToHex, hexToBytes } from "./binary"

describe("binary encoding helpers", () => {
  it("round-trips arbitrary binary bytes without text decoding", () => {
    const bytes = Uint8Array.from([0, 1, 127, 128, 255])

    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes)
    expect(hexToBytes(bytesToHex(bytes))).toEqual(bytes)
  })

  it("rejects malformed hexadecimal input", () => {
    expect(() => hexToBytes("abc")).toThrow("Invalid hexadecimal input")
    expect(() => hexToBytes("zz")).toThrow("Invalid hexadecimal input")
  })
})
