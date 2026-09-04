import { describe, expect, it } from "vitest"

import { crc32Bytes, createIncrementalHasher, hashBytes } from "./hash-algorithms"

const ABC = new TextEncoder().encode("abc")

/**
 * 标准测试向量。迁移到 @noble/hashes 之前，这些结果分别由 crypto-js、sha3 包
 * 和服务端 /api/hash 产生；此处逐一锁定，确保换实现没有改变任何一个输出。
 */
const VECTORS: Array<[string, number | undefined, string]> = [
  ["md5", undefined, "900150983cd24fb0d6963f7d28e17f72"],
  ["sha1", undefined, "a9993e364706816aba3e25717850c26c9cd0d89d"],
  ["ripemd160", undefined, "8eb208f7e05d987a9b044a8e98c6b087f15a0bfc"],
  ["sha2", 224, "23097d223405d8228642a477bda255b32aadbce4bda0b3f7e36c9da7"],
  ["sha2", 256, "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"],
  [
    "sha2",
    512,
    "ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a" +
      "2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f",
  ],
  ["sha3", 256, "3a985da74fe225b2045c172d6bd390bd855f086e3e9d525b46bfe24511431532"],
  ["keccak", 256, "4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45"],
  ["shake", 128, "5881092dd818bf5cf8a3ddb793fbcba7"],
  ["shake", 256, "483366601360a8771c6863080cc4114d8db44530f8f1e1ee4f94ea37e78b5739"],
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

describe("hash-algorithms", () => {
  it.each(VECTORS)("%s(size=%s) 与标准向量一致", async (algorithm, size, expected) => {
    expect(await hashBytes(ABC, algorithm, size, "hex")).toBe(expected)
  })

  it("画布适配器的带后缀写法与工具页的 id+size 写法结果相同", async () => {
    const pairs: Array<[string, [string, number]]> = [
      ["sha3-256", ["sha3", 256]],
      ["keccak-512", ["keccak", 512]],
      ["shake-128", ["shake", 128]],
      ["sha512-256", ["sha512", 256]],
      ["sha2-224", ["sha2", 224]],
    ]
    for (const [suffixed, [id, size]] of pairs) {
      expect(await hashBytes(ABC, suffixed, undefined, "hex"), suffixed).toBe(
        await hashBytes(ABC, id, size, "hex"),
      )
    }
  })

  it("分块 update 的结果与一次性计算相同", async () => {
    const long = new TextEncoder().encode("x".repeat(5000))
    for (const [algorithm, size] of VECTORS) {
      const streamed = await createIncrementalHasher(algorithm, size, size ?? 256, "hex")
      for (let offset = 0; offset < long.length; offset += 997) {
        streamed.update(long.subarray(offset, offset + 997))
      }
      expect(streamed.digest(), `${algorithm} 分块结果不一致`).toBe(
        await hashBytes(long, algorithm, size, "hex"),
      )
    }
  })

  it("base64 输出与 hex 输出表示同一串字节", async () => {
    for (const [algorithm, size] of VECTORS) {
      const hex = await hashBytes(ABC, algorithm, size, "hex")
      const base64 = await hashBytes(ABC, algorithm, size, "base64")
      const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0))
      expect([...bytes].map((b) => b.toString(16).padStart(2, "0")).join(""), algorithm).toBe(hex)
    }
  })

  it("CRC32 按字节计算，文本与文件模式一致", async () => {
    expect(crc32Bytes(ABC).toString(16)).toBe("352441c2")
    expect(await hashBytes(ABC, "crc32", undefined, "hex")).toBe("352441c2")
  })

  it("空输入也有确定结果", async () => {
    expect(await hashBytes(new Uint8Array(), "md5", undefined, "hex")).toBe(
      "d41d8cd98f00b204e9800998ecf8427e",
    )
    expect(await hashBytes(new Uint8Array(), "sm3", undefined, "hex")).toBe(
      "1ab21d8355cfa17f8e61194831e81a8f22bec8c728fefb747ed035eb5082aa2b",
    )
  })

  it("拒绝不支持的算法与长度", async () => {
    await expect(hashBytes(ABC, "nope", undefined, "hex")).rejects.toThrow(/Unsupported/)
    await expect(hashBytes(ABC, "shake", 512, "hex")).rejects.toThrow(/Unsupported/)
  })
})
