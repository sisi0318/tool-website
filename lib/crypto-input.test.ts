import { describe, expect, it } from "vitest"
import {
  CryptoInputError,
  bytesToHex,
  cryptoInputByteLength,
  parseCryptoInput,
  safeCryptoDownloadName,
} from "./crypto-input"

describe("crypto input", () => {
  it("parses strict even-length hexadecimal bytes", () => {
    expect(parseCryptoInput("00a1FF", "hex")).toEqual(
      Uint8Array.from([0, 161, 255]),
    )
    expect(() => parseCryptoInput("abc", "hex")).toThrow(CryptoInputError)
    expect(() => parseCryptoInput("zz", "hex")).toThrow(CryptoInputError)
  })

  it("accepts padded or unpadded base64 and rejects malformed padding", () => {
    expect(parseCryptoInput("AQI=", "base64")).toEqual(Uint8Array.from([1, 2]))
    expect(parseCryptoInput("AQI", "base64")).toEqual(Uint8Array.from([1, 2]))
    expect(() => parseCryptoInput("A=QI", "base64")).toThrow(CryptoInputError)
  })

  it("distinguishes UTF-8 raw text from byte-preserving Latin-1", () => {
    expect(parseCryptoInput("你", "raw", "utf8")).toHaveLength(3)
    expect(parseCryptoInput("ÿ", "raw", "latin1")).toEqual(Uint8Array.from([255]))
    expect(() => parseCryptoInput("你", "raw", "latin1")).toThrow(CryptoInputError)
  })

  it("reports invalid formatted lengths without throwing", () => {
    expect(cryptoInputByteLength("0011", "hex")).toBe(2)
    expect(cryptoInputByteLength("001", "hex")).toBeNull()
  })

  it("formats bytes and safe download names", () => {
    expect(bytesToHex(Uint8Array.from([0, 15, 255]))).toBe("000fff")
    expect(safeCryptoDownloadName('a<b>:"c.bin')).toBe("a_b___c.bin")
  })
})
