import { describe, expect, it } from "vitest"

import { PortConversionError, convertPortValue } from "./convert-value"
import { isTypeCompatible } from "./validation"
import type { DataType } from "./types"

describe("convertPortValue", () => {
  it("同类型直接透传，包括对象引用", () => {
    const value = { a: 1 }
    expect(convertPortValue(value, "json", "json")).toBe(value)
    expect(convertPortValue("x", "string", "string")).toBe("x")
  })

  it("json → string 序列化，而不是 [object Object]", () => {
    // 这正是此前的 bug：String(对象) 得到 "[object Object]"，还会被拿去算哈希
    expect(convertPortValue({ b: 1, a: 2 }, "json", "string")).toBe('{"b":1,"a":2}')
    expect(convertPortValue([1, 2], "json", "string")).toBe("[1,2]")
    expect(String({ b: 1 })).toBe("[object Object]")
  })

  it("string → json 解析，非法 JSON 报错而不是静默通过", () => {
    expect(convertPortValue('{"a":1}', "string", "json")).toEqual({ a: 1 })
    expect(() => convertPortValue("not json", "string", "json")).toThrow(PortConversionError)
    expect(() => convertPortValue("   ", "string", "json")).toThrow(/输入为空/)
  })

  it("string → number 拒绝非数值，而不是给出 NaN", () => {
    expect(convertPortValue("42", "string", "number")).toBe(42)
    expect(convertPortValue(" -3.5 ", "string", "number")).toBe(-3.5)
    // 汇率节点此前会因为 Number("abc") 输出 NaN
    expect(() => convertPortValue("abc", "string", "number")).toThrow(/不是数值/)
    expect(() => convertPortValue("", "string", "number")).toThrow(/输入为空/)
  })

  it('string → boolean 认得 "false"，不再一律为真', () => {
    expect(convertPortValue("true", "string", "boolean")).toBe(true)
    // Boolean("false") 是 true —— 此前 json-format 的 sortKeys 就栽在这
    expect(convertPortValue("false", "string", "boolean")).toBe(false)
    expect(convertPortValue("0", "string", "boolean")).toBe(false)
    expect(convertPortValue("YES", "string", "boolean")).toBe(true)
    expect(() => convertPortValue("maybe", "string", "boolean")).toThrow(/既不是真也不是假/)
  })

  it("数值与布尔互转", () => {
    expect(convertPortValue(0, "number", "boolean")).toBe(false)
    expect(convertPortValue(3, "number", "boolean")).toBe(true)
    expect(convertPortValue(true, "boolean", "number")).toBe(1)
    expect(convertPortValue(false, "boolean", "string")).toBe("false")
    expect(convertPortValue(7, "number", "string")).toBe("7")
  })

  it("跨类型时拒绝非有限数值，避免 NaN 被转成字符串继续下传", () => {
    expect(() => convertPortValue(Number.NaN, "number", "string")).toThrow(/不是有限数值/)
    expect(() => convertPortValue(Infinity, "number", "string")).toThrow(/不是有限数值/)
    expect(() => convertPortValue(Number.NaN, "number", "boolean")).toThrow(/不是有限数值/)
    // 同类型是透传，不做校验：节点自己产出 NaN 是它自己的问题
    expect(convertPortValue(Number.NaN, "number", "number")).toBeNaN()
  })

  it("bytes 不与其它类型互转", () => {
    expect(() => convertPortValue(new Uint8Array(), "bytes", "string")).toThrow(
      /不能与其它类型互转/,
    )
    expect(() => convertPortValue("x", "string", "bytes")).toThrow(/不能与其它类型互转/)
  })

  /**
   * 连线校验说某个方向可连，运行时就必须真能转过去，
   * 否则用户连出来的边注定在执行时报错。
   */
  it("兼容矩阵允许的每个方向都有可用的转换", () => {
    const samples: Record<DataType, unknown> = {
      string: "1",
      number: 1,
      boolean: true,
      json: { a: 1 },
      bytes: new Uint8Array([1]),
    }
    const types: DataType[] = ["string", "number", "boolean", "json", "bytes"]

    for (const from of types) {
      for (const to of types) {
        if (!isTypeCompatible(from, to)) continue
        expect(
          () => convertPortValue(samples[from], from, to),
          `矩阵允许 ${from} → ${to}，但转换会抛错`,
        ).not.toThrow()
      }
    }
  })
})
