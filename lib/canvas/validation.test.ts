import { describe, it, expect } from "vitest"
import { validateConnection, canAcceptInput } from "./validation"
import type { ConfigField, Edge } from "./types"

describe("validateConnection", () => {
  it("相同类型返回 ok", () => {
    const source: ConfigField = { id: "s", name: "S", dataType: "string" }
    const target: ConfigField = { id: "t", name: "T", dataType: "string" }
    expect(validateConnection(source, target)).toEqual({ valid: true, level: "ok" })
  })

  it("string 和 number 兼容", () => {
    const source: ConfigField = { id: "s", name: "S", dataType: "string" }
    const target: ConfigField = { id: "t", name: "T", dataType: "number" }
    expect(validateConnection(source, target).valid).toBe(true)
  })

  it("string 和 bytes 不兼容", () => {
    const source: ConfigField = { id: "s", name: "S", dataType: "string" }
    const target: ConfigField = { id: "t", name: "T", dataType: "bytes" }
    expect(validateConnection(source, target).valid).toBe(false)
  })
})

describe("canAcceptInput", () => {
  it("已有连线时返回 false", () => {
    const existing: Edge[] = [
      { id: "e1", source: "a", sourcePort: "o", target: "b", targetPort: "i" },
    ]
    expect(canAcceptInput(existing, "s", "b", "i")).toBe(false)
  })

  it("无连线时返回 true", () => {
    const existing: Edge[] = []
    expect(canAcceptInput(existing, "s", "b", "i")).toBe(true)
  })
})
