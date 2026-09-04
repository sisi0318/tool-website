import { blake2b, blake2s } from "@noble/hashes/blake2.js"
import { sha512_224, sha512_256 } from "@noble/hashes/sha2.js"

/**
 * BLAKE2、SM3 与 SHA-512/t 在浏览器里没有原生实现，此前只能把文本或整个文件
 * POST 到 /api/hash 由服务端计算 —— 与“本地处理、不上传”的定位相悖，也给了
 * 服务端一个无上限的内存入口。这里补齐纯客户端实现：
 *
 * - BLAKE2b / BLAKE2s / SHA-512/t 用 @noble/hashes（纯 JS、同步、可增量）
 * - SM3 用 hash-wasm，按需动态加载，只有真正选到它时才会拉取那份 WASM
 */

export type HashOutputFormat = "hex" | "base64"

export interface ExtraHasher {
  update(bytes: Uint8Array): void
  digest(): string
}

/** 算法 id 在工具页与画布适配器里写法不同，这里统一归一化。 */
function normalize(algorithmId: string, size?: number): string {
  if (algorithmId === "sha512") return `sha512-${size ?? 224}`
  return algorithmId
}

const SUPPORTED = new Set(["blake2s256", "blake2b512", "sm3", "sha512-224", "sha512-256"])

export function isExtraHashAlgorithm(algorithmId: string, size?: number): boolean {
  return SUPPORTED.has(normalize(algorithmId, size))
}

function encodeDigest(bytes: Uint8Array, outputFormat: HashOutputFormat): string {
  if (outputFormat === "base64") {
    let binary = ""
    for (const byte of bytes) binary += String.fromCharCode(byte)
    return btoa(binary)
  }
  let hex = ""
  for (const byte of bytes) hex += byte.toString(16).padStart(2, "0")
  return hex
}

/** noble 的 create() 返回同步增量 hasher，包一层统一成本模块的接口。 */
function fromNoble(
  instance: { update(bytes: Uint8Array): unknown; digest(): Uint8Array },
  outputFormat: HashOutputFormat,
): ExtraHasher {
  return {
    update: (bytes) => {
      instance.update(bytes)
    },
    digest: () => encodeDigest(instance.digest(), outputFormat),
  }
}

export async function createExtraHasher(
  algorithmId: string,
  size: number | undefined,
  outputFormat: HashOutputFormat,
): Promise<ExtraHasher> {
  switch (normalize(algorithmId, size)) {
    case "blake2s256":
      return fromNoble(blake2s.create({ dkLen: 32 }), outputFormat)
    case "blake2b512":
      return fromNoble(blake2b.create({ dkLen: 64 }), outputFormat)
    case "sha512-224":
      return fromNoble(sha512_224.create(), outputFormat)
    case "sha512-256":
      return fromNoble(sha512_256.create(), outputFormat)
    case "sm3": {
      // 只有选到 SM3 时才加载 WASM，不进首屏包。
      const { createSM3 } = await import("hash-wasm")
      const hasher = await createSM3()
      return {
        update: (bytes) => {
          hasher.update(bytes)
        },
        digest: () => encodeDigest(hasher.digest("binary"), outputFormat),
      }
    }
    default:
      throw new Error(`Unsupported hash algorithm: ${algorithmId}`)
  }
}

/** 一次性计算，供不需要分块的调用方使用。 */
export async function hashExtra(
  data: Uint8Array,
  algorithmId: string,
  size: number | undefined,
  outputFormat: HashOutputFormat,
): Promise<string> {
  const hasher = await createExtraHasher(algorithmId, size, outputFormat)
  hasher.update(data)
  return hasher.digest()
}
