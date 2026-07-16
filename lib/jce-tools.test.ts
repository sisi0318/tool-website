import { describe, expect, it } from "vitest"
import { decodeJceBase64, parseJceJson } from "./jce-tools"

describe("JCE tools", () => {
  it("decodes every possible byte from Base64 without text conversion", () => {
    expect([...decodeJceBase64("AP+Afg==")]).toEqual([0, 255, 128, 126])
  })

  it("preserves integers outside the safe Number range as BigInt", () => {
    const parsed = parseJceJson('{"0":9223372036854775807,"1":-9223372036854775808,"2":1.5}') as Record<string, unknown>
    expect(parsed["0"]).toBe(BigInt("9223372036854775807"))
    expect(parsed["1"]).toBe(BigInt("-9223372036854775808"))
    expect(parsed["2"]).toBe(1.5)
  })
})
