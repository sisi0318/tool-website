import { describe, it, expect } from "vitest"
import { validateJsonTypename, createJsonPort, validateJsonConnection } from "./json-meta"

describe("validateJsonTypename", () => {
  it("相同 typename 返回 match", () => {
    expect(validateJsonTypename("TypeA", "TypeA")).toBe("match")
  })

  it("不同 typename 返回 mismatch", () => {
    expect(validateJsonTypename("TypeA", "TypeB")).toBe("mismatch")
  })

  it("任一 typename 为空返回 compatible", () => {
    expect(validateJsonTypename(undefined, "TypeA")).toBe("compatible")
    expect(validateJsonTypename("TypeA", undefined)).toBe("compatible")
    expect(validateJsonTypename(undefined, undefined)).toBe("compatible")
  })
})

describe("createJsonPort", () => {
  it("创建带 typename 的 JSON 端口", () => {
    const port = createJsonPort("out1", "输出", "DeviceInfo")
    expect(port.dataType).toBe("json")
    expect(port.jsonTypename).toBe("DeviceInfo")
    expect(port.id).toBe("out1")
    expect(port.name).toBe("输出")
  })

  it("创建不带 typename 的 JSON 端口", () => {
    const port = createJsonPort("out1", "Output")
    expect(port.dataType).toBe("json")
    expect(port.jsonTypename).toBeUndefined()
  })
})

describe("validateJsonConnection", () => {
  it("相同 typename 返回 ok", () => {
    const result = validateJsonConnection("TypeA", "TypeA")
    expect(result.valid).toBe(true)
    expect(result.level).toBe("ok")
  })

  it("不同 typename 返回 warning", () => {
    const result = validateJsonConnection("TypeA", "TypeB")
    expect(result.valid).toBe(true)
    expect(result.level).toBe("warning")
    expect(result.message).toContain("mismatch")
  })

  it("typename 为空返回 ok", () => {
    const result = validateJsonConnection(undefined, "TypeA")
    expect(result.valid).toBe(true)
    expect(result.level).toBe("ok")
  })
})
