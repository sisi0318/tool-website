import { describe, it, expect } from "vitest"
import { validateConnection, canAcceptInput } from "./validation"
import type { PortDefinition, Edge } from "./types"

describe("validateConnection", () => {
  it("相同类型返回 ok", () => {
    const source: PortDefinition = { id: "s", name: "S", dataType: "string" }
    const target: PortDefinition = { id: "t", name: "T", dataType: "string" }
    expect(validateConnection(source, target)).toEqual({ valid: true, level: "ok" })
  })

  it("string 和 number 兼容", () => {
    const source: PortDefinition = { id: "s", name: "S", dataType: "string" }
    const target: PortDefinition = { id: "t", name: "T", dataType: "number" }
    expect(validateConnection(source, target).valid).toBe(true)
  })

  it("string 和 bytes 不兼容", () => {
    const source: PortDefinition = { id: "s", name: "S", dataType: "string" }
    const target: PortDefinition = { id: "t", name: "T", dataType: "bytes" }
    expect(validateConnection(source, target).valid).toBe(false)
  })

  it("JSON typename 不匹配返回 warning", () => {
    const source: PortDefinition = { id: "s", name: "S", dataType: "json", jsonTypename: "TypeA" }
    const target: PortDefinition = { id: "t", name: "T", dataType: "json", jsonTypename: "TypeB" }
    const result = validateConnection(source, target)
    expect(result.valid).toBe(true)
    expect(result.level).toBe("warning")
  })
})

describe("canAcceptInput", () => {
  it("已有连线时返回 false", () => {
    const existing: Edge[] = [
      { id: "e1", source: "a", sourcePort: "o", target: "b", targetPort: "i" },
    ]
    const source: PortDefinition = { id: "s", name: "S", dataType: "string" }
    const target: PortDefinition = { id: "i", name: "T", dataType: "string" }
    expect(canAcceptInput(existing, source, target)).toBe(false)
  })

  it("无连线且类型兼容返回 true", () => {
    const existing: Edge[] = []
    const source: PortDefinition = { id: "s", name: "S", dataType: "string" }
    const target: PortDefinition = { id: "t", name: "T", dataType: "string" }
    expect(canAcceptInput(existing, source, target)).toBe(true)
  })
})
