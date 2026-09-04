import { describe, expect, it } from "vitest"

import { createExtraHasher, hashExtra, isExtraHashAlgorithm } from "./hash-extra"

const ABC = new TextEncoder().encode("abc")

/** 标准测试向量（"abc"），与 Node 内置实现 / RFC 对齐。 */
const VECTORS: Array<[string, number | undefined, string]> = [
  ["blake2s256", undefined, "508c5e8c327c14e2e1a72ba34eeb452f37458b209ed63a294d999b4c86675982"],
  [
    "blake2b512",
    undefined,
    "ba80a53f981c4d0d6a2797b69f12f6e94c212f14685ac4b74b12bb6fdbffa2d1" +
      "7d87c5392aab792dc252d5de4533cc9518d38aa8dbf1925ab92386edd4009923",
  ],
  ["sm3", undefined, "66c7f0f462eeedd9d1f2d46bdc10e4e24167c4875cf2f7a2297da02b8f4ba8e0"],
  ["sha512", 224, "4634270f707b6a54daae7530460842e20e37ed265ceee9a43e8924aa"],
  ["sha512", 256, "53048e2681941ef99b2e29b76b4c7dabe4c2d0c634fc6d46e0e2f13107e7af23"],
]

describe("hash-extra", () => {
  it.each(VECTORS)("%s(size=%s) 与标准向量一致", async (algorithm, size, expected) => {
    expect(await hashExtra(ABC, algorithm, size, "hex")).toBe(expected)
  })

  it("分块 update 的结果与一次性计算相同", async () => {
    const long = new TextEncoder().encode("x".repeat(5000))
    for (const [algorithm, size] of VECTORS) {
      const streamed = await createExtraHasher(algorithm, size, "hex")
      for (let offset = 0; offset < long.length; offset += 997) {
        streamed.update(long.subarray(offset, offset + 997))
      }
      expect(streamed.digest(), `${algorithm} 分块结果不一致`).toBe(
        await hashExtra(long, algorithm, size, "hex"),
      )
    }
  })

  it("支持 base64 输出", async () => {
    const hex = await hashExtra(ABC, "sm3", undefined, "hex")
    const base64 = await hashExtra(ABC, "sm3", undefined, "base64")
    const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0))
    expect([...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")).toBe(hex)
  })

  it("接受工具页与适配器两种算法 id 写法", async () => {
    expect(isExtraHashAlgorithm("sha512", 256)).toBe(true)
    expect(isExtraHashAlgorithm("sha512-256")).toBe(true)
    expect(await hashExtra(ABC, "sha512-256", undefined, "hex")).toBe(
      await hashExtra(ABC, "sha512", 256, "hex"),
    )
  })

  it("空输入也有确定结果", async () => {
    expect(await hashExtra(new Uint8Array(), "sm3", undefined, "hex")).toBe(
      "1ab21d8355cfa17f8e61194831e81a8f22bec8c728fefb747ed035eb5082aa2b",
    )
  })

  it("拒绝不支持的算法", async () => {
    expect(isExtraHashAlgorithm("md5")).toBe(false)
    await expect(hashExtra(ABC, "md5", undefined, "hex")).rejects.toThrow(/Unsupported/)
  })
})
