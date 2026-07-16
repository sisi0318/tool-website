import { describe, expect, it } from "vitest"
import {
  decodePunycodeDomain,
  encodePunycodeDomain,
  findEncodingType,
  transformEncoding,
  type EncodingType,
} from "./encoding-tools"

describe("encoding tools", () => {
  it("encodes and decodes an internationalized domain name", () => {
    expect(encodePunycodeDomain("测试.com")).toBe("xn--0zwm56d.com")
    expect(decodePunycodeDomain("xn--0zwm56d.com")).toBe("测试.com")
  })

  it("handles multiple Unicode labels without splitting surrogate pairs", () => {
    const domain = "😀.例子.test"
    expect(decodePunycodeDomain(encodePunycodeDomain(domain))).toBe(domain)
  })

  const roundTripTypes: EncodingType[] = [
    "base64",
    "url",
    "hex",
    "unicode",
    "utf8",
    "ascii",
    "base32",
    "base58",
    "base85",
    "binary",
    "octal",
    "html",
    "morse",
    "rot13",
    "quoted",
  ]

  it.each(roundTripTypes)("round-trips %s without legacy page state", (type) => {
    const input = "HELLO 123!"
    const encoded = transformEncoding(input, type, "encode")
    expect(transformEncoding(encoded, type, "decode")).toBe(input)
  })

  it("preserves Unicode code points and UTF-8 bytes", () => {
    const input = "你好 😀"
    expect(transformEncoding(transformEncoding(input, "unicode", "encode"), "unicode", "decode")).toBe(input)
    expect(transformEncoding(transformEncoding(input, "base64", "encode"), "base64", "decode")).toBe(input)
    expect(transformEncoding(transformEncoding(input, "utf8", "encode"), "utf8", "decode")).toBe(input)
  })

  it("supports independent per-line conversion", () => {
    const encoded = transformEncoding("one\ntwo", "base64", "encode", true)
    expect(encoded).toBe("b25l\ndHdv")
    expect(transformEncoding(encoded, "base64", "decode", true)).toBe("one\ntwo")
  })

  it("rejects malformed byte input instead of returning replacement characters", () => {
    expect(() => transformEncoding("0", "hex", "decode")).toThrow("两位")
    expect(() => transformEncoding("0101", "binary", "decode")).toThrow("8 位")
    expect(() => transformEncoding("256", "ascii", "decode")).toThrow("0–127")
  })

  it("finds a format from workspace feature names and aliases", () => {
    expect(findEncodingType("URL 编码")).toBe("url")
    expect(findEncodingType("十六进制")).toBe("hex")
    expect(findEncodingType("HTML 实体")).toBe("html")
  })
})
