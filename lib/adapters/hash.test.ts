import { describe, it, expect, beforeEach } from "vitest"
import { hashAdapter, registerHashAdapter } from "./hash"
import { getNodeDefinition, clearRegistry } from "../canvas/registry"

beforeEach(() => {
  clearRegistry()
  registerHashAdapter()
})

describe("hashAdapter", () => {
  it("定义正确", () => {
    expect(hashAdapter.type).toBe("hash")
    expect(hashAdapter.category).toBe("crypto")
    expect(hashAdapter.config).toHaveLength(4)
    expect(hashAdapter.outputs).toHaveLength(1)
    expect(hashAdapter.outputs[0].id).toBe("hash")
  })

  it("SHA-256 哈希计算", async () => {
    const result = await hashAdapter.execute({ data: "hello" }, { algorithm: "sha256", outputFormat: "hex" })
    expect(result.hash).toBeDefined()
    expect(result.hash).toHaveLength(64)
  })

  it("MD5 哈希计算", async () => {
    const result = await hashAdapter.execute({ data: "hello" }, { algorithm: "md5", outputFormat: "hex" })
    expect(result.hash).toHaveLength(32)
  })

  it("SHA-1 哈希计算", async () => {
    const result = await hashAdapter.execute({ data: "hello" }, { algorithm: "sha1", outputFormat: "hex" })
    expect(result.hash).toHaveLength(40)
  })

  it("注册后可通过 getNodeDefinition 获取", () => {
    expect(getNodeDefinition("hash")).toBeDefined()
  })
})
