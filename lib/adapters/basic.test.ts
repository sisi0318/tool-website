import { describe, it, expect, beforeEach } from "vitest"
import { stringNode, numberNode, jsonNode, fileNode, booleanNode, registerBasicNodes } from "./basic"
import { getNodeDefinition, clearRegistry } from "../canvas/registry"

beforeEach(() => {
  clearRegistry()
  registerBasicNodes()
})

describe("stringNode", () => {
  it("定义正确", () => {
    expect(stringNode.type).toBe("string")
    expect(stringNode.category).toBe("basic")
    expect(stringNode.config).toHaveLength(1)
    expect(stringNode.config[0].dataType).toBe("string")
    expect(stringNode.config[0].hasInput).toBe(true)
    expect(stringNode.config[0].hasOutput).toBe(true)
  })

  it("execute 返回配置值", async () => {
    const result = await stringNode.execute({}, { value: "hello" })
    expect(result).toEqual({ value: "hello" })
  })
})

describe("numberNode", () => {
  it("定义正确", () => {
    expect(numberNode.type).toBe("number")
    expect(numberNode.config[0].dataType).toBe("number")
    expect(numberNode.config[0].hasInput).toBe(true)
    expect(numberNode.config[0].hasOutput).toBe(true)
  })

  it("execute 返回数字", async () => {
    const result = await numberNode.execute({}, { value: 42 })
    expect(result).toEqual({ value: 42 })
  })
})

describe("jsonNode", () => {
  it("execute 解析 JSON", async () => {
    const result = await jsonNode.execute({}, { value: '{"key":"value"}' })
    expect(result).toEqual({ parsed: { key: "value" } })
  })

  it("execute 无效 JSON 抛出错误", async () => {
    await expect(jsonNode.execute({}, { value: "invalid" })).rejects.toThrow()
  })
})

describe("booleanNode", () => {
  it("定义正确", () => {
    expect(booleanNode.type).toBe("boolean")
    expect(booleanNode.category).toBe("basic")
    expect(booleanNode.config).toHaveLength(1)
    expect(booleanNode.config[0].dataType).toBe("boolean")
    expect(booleanNode.config[0].hasInput).toBe(true)
    expect(booleanNode.config[0].hasOutput).toBe(true)
  })

  it("execute 返回 true", async () => {
    const result = await booleanNode.execute({}, { value: true })
    expect(result).toEqual({ value: true })
  })

  it("execute 返回 false", async () => {
    const result = await booleanNode.execute({}, { value: false })
    expect(result).toEqual({ value: false })
  })

  it("execute 默认值 false", async () => {
    const result = await booleanNode.execute({}, {})
    expect(result).toEqual({ value: false })
  })

  it("execute 输入优先于配置", async () => {
    const result = await booleanNode.execute({ value: true }, { value: false })
    expect(result).toEqual({ value: true })
  })
})

describe("registerBasicNodes", () => {
  it("注册后可通过 getNodeDefinition 获取", () => {
    expect(getNodeDefinition("string")).toBeDefined()
    expect(getNodeDefinition("number")).toBeDefined()
    expect(getNodeDefinition("json")).toBeDefined()
    expect(getNodeDefinition("file")).toBeDefined()
    expect(getNodeDefinition("boolean")).toBeDefined()
  })
})
