import { beforeEach, describe, expect, it } from "vitest"

import { registerAllAdapters } from "../adapters"
import { clearRegistry } from "./registry"
import { createCanvasNode, withDefaultConfig } from "./node-factory"

beforeEach(() => {
  clearRegistry()
  registerAllAdapters()
})

describe("withDefaultConfig", () => {
  it("补齐声明了 defaultValue 的字段", () => {
    const config = withDefaultConfig("classic-cipher", {})
    // 之前 config 恒为 {},shift 的 visible(config.algorithm === "caesar") 永远为假,
    // 新建的古典密码节点上根本看不到 Shift 参数
    expect(config.algorithm).toBe("caesar")
    expect(config.shift).toBe(3)
  })

  it("不覆盖已有取值", () => {
    const config = withDefaultConfig("classic-cipher", { algorithm: "rot13" })
    expect(config.algorithm).toBe("rot13")
    expect(config.shift).toBe(3)
  })

  it("未注册的类型原样返回", () => {
    expect(withDefaultConfig("not-a-tool", { a: 1 })).toEqual({ a: 1 })
    expect(withDefaultConfig("not-a-tool", undefined)).toEqual({})
  })

  it("createCanvasNode 建出的节点带默认配置", () => {
    const node = createCanvasNode("hash", { x: 0, y: 0 })
    expect(node.type).toBe("hash")
    expect(node.config).toMatchObject({ category: "md", algorithm: "md5", outputFormat: "hex" })
    expect(node.id).toMatch(/^node-/)
  })

  it("id 唯一", () => {
    const ids = new Set(
      Array.from({ length: 50 }, () => createCanvasNode("string", { x: 0, y: 0 }).id),
    )
    expect(ids.size).toBe(50)
  })
})
