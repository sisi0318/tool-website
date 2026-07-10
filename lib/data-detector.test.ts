import { describe, expect, it } from "vitest"
import { detectData } from "./data-detector"

describe("detectData", () => {
  it("does not share the best-match object with the matches array", () => {
    const result = detectData('{"name":"tool"}')
    expect(result.best).not.toBe(result.matches[0])
  })

  it.each([
    ['{"name":"tool"}', "json"],
    ["<?xml version=\"1.0\"?><root><item>1</item></root>", "xml"],
    ["550e8400-e29b-41d4-a716-446655440000", "uuid"],
    ["1704067200", "timestamp"],
    ["name,age\nAda,36\nLinus,54", "csv"],
    ["SGVsbG8gd29ybGQ=", "base64"],
  ])("detects %s as %s", (input, expected) => {
    expect(detectData(input).best.type).toBe(expected)
  })

  it("decodes JWT header and payload", () => {
    const token = "eyJhbGciOiJub25lIn0.eyJzdWIiOiIxMjMifQ.signature"
    const result = detectData(token)
    expect(result.best.type).toBe("jwt")
    expect(result.best.decodedPreview).toContain('"sub": "123"')
  })

  it("recognizes a Base64 encoded gzip signature", () => {
    const result = detectData("H4sIAAAAAAAA")
    expect(result.matches.some((match) => match.type === "gzip")).toBe(true)
  })
})
