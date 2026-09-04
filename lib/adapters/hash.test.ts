import { describe, it, expect, beforeEach, vi } from "vitest"
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
    const result = await hashAdapter.execute({ data: "hello" }, { category: "sha2", algorithm: "sha2-256", outputFormat: "hex" })
    expect(result.hash).toBeDefined()
    expect(result.hash).toHaveLength(64)
  })

  it("MD5 哈希计算", async () => {
    const result = await hashAdapter.execute({ data: "hello" }, { category: "md", algorithm: "md5", outputFormat: "hex" })
    expect(result.hash).toHaveLength(32)
  })

  it("SHA-1 哈希计算", async () => {
    const result = await hashAdapter.execute({ data: "hello" }, { category: "sha1", algorithm: "sha1", outputFormat: "hex" })
    expect(result.hash).toHaveLength(40)
  })

  it("注册后可通过 getNodeDefinition 获取", () => {
    expect(getNodeDefinition("hash")).toBeDefined()
  })
})

describe("BLAKE2 / SM3 / SHA-512-t 本地化", () => {
  it("不再向 /api/hash 发请求,且结果符合标准向量", async () => {
    const fetchSpy = vi.fn(() => Promise.reject(new Error("网络请求不应发生")))
    vi.stubGlobal("fetch", fetchSpy)
    try {
      const def = getNodeDefinition("hash")!
      const cases: Array<[string, string]> = [
        ["blake2s256", "508c5e8c327c14e2e1a72ba34eeb452f37458b209ed63a294d999b4c86675982"],
        [
          "blake2b512",
          "ba80a53f981c4d0d6a2797b69f12f6e94c212f14685ac4b74b12bb6fdbffa2d1" +
            "7d87c5392aab792dc252d5de4533cc9518d38aa8dbf1925ab92386edd4009923",
        ],
        ["sm3", "66c7f0f462eeedd9d1f2d46bdc10e4e24167c4875cf2f7a2297da02b8f4ba8e0"],
        ["sha512-224", "4634270f707b6a54daae7530460842e20e37ed265ceee9a43e8924aa"],
        ["sha512-256", "53048e2681941ef99b2e29b76b4c7dabe4c2d0c634fc6d46e0e2f13107e7af23"],
      ]
      for (const [algorithm, expected] of cases) {
        const result = await def.execute({ data: "abc", algorithm }, {})
        expect(result.hash, algorithm).toBe(expected)
      }
      expect(fetchSpy).not.toHaveBeenCalled()
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
