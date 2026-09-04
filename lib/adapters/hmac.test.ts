import { beforeEach, describe, expect, it } from "vitest"

import { clearRegistry, getNodeDefinition } from "../canvas/registry"
import { registerHmacAdapter } from "./hmac"

beforeEach(() => {
  clearRegistry()
  registerHmacAdapter()
})

/**
 * 这些值在迁移到 @noble/hashes 之前由 crypto-js 产生，逐一锁定以保证换实现
 * 没有改变任何输出。
 */
const VECTORS: Array<[string, string]> = [
  ["md5", "62ed525986ad54708b53e79ec5ddd95c"],
  ["sha1", "cdf8463639ca199bc49b127a4593194c17cf45d1"],
  ["sha256", "9d3453257014a56eb2384a2f3d3018aaa787471de541e91c1cafe7772ba7ba21"],
]

describe("hmacAdapter", () => {
  it("与 crypto-js 时期的输出一致", async () => {
    const def = getNodeDefinition("hmac")!
    for (const [algorithm, expected] of VECTORS) {
      const result = await def.execute({ data: "message 中文", key: "secret", algorithm }, {})
      expect(result.hmac, algorithm).toBe(expected)
    }
  })

  it("base64 输出与 hex 输出表示同一串字节", async () => {
    const def = getNodeDefinition("hmac")!
    const hex = String((await def.execute({ data: "d", key: "k", algorithm: "sha256" }, {})).hmac)
    const base64 = String(
      (await def.execute({ data: "d", key: "k", algorithm: "sha256", outputFormat: "base64" }, {}))
        .hmac,
    )
    const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0))
    expect([...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("")).toBe(hex)
  })

  it("拒绝不支持的算法", async () => {
    const def = getNodeDefinition("hmac")!
    await expect(
      def.execute({ data: "d", key: "k", algorithm: "sha3-256" }, {}),
    ).rejects.toThrow(/Unsupported algorithm/)
  })
})
