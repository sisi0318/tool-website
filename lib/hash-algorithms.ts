import { md5, ripemd160, sha1 } from "@noble/hashes/legacy.js"
import { blake2b, blake2s } from "@noble/hashes/blake2.js"
import { sha224, sha256, sha384, sha512, sha512_224, sha512_256 } from "@noble/hashes/sha2.js"
import {
  keccak_224,
  keccak_256,
  keccak_384,
  keccak_512,
  sha3_224,
  sha3_256,
  sha3_384,
  sha3_512,
  shake128,
  shake256,
} from "@noble/hashes/sha3.js"
import type { CHash } from "@noble/hashes/utils.js"

/**
 * 全站唯一的哈希算法实现来源。此前这套逻辑有三份：工具页用 crypto-js + sha3 包，
 * 画布适配器另写一份，BLAKE2 / SM3 / SHA-512-t 则要上传到 /api/hash 由服务端算。
 * 现在统一到 @noble/hashes（仍在维护、零依赖、纯 JS），SM3 由 hash-wasm 按需补上。
 */

export type HashOutputFormat = "hex" | "base64"

export interface IncrementalHasher {
  update(bytes: Uint8Array): void
  digest(): string
}

/** 固定摘要长度的算法。 */
const FIXED_HASHERS: Record<string, CHash> = {
  md5,
  sha1,
  sha224,
  sha256,
  sha384,
  sha512,
  ripemd160,
  // 画布适配器使用的带前缀写法
  "sha2-224": sha224,
  "sha2-256": sha256,
  "sha2-384": sha384,
  "sha2-512": sha512,
}

/**
 * 需要按所选长度取实现的算法。
 * SHAKE 是 XOF，noble 的默认输出长度（128→16B、256→32B）与旧的 sha3 包一致。
 */
const SIZED_HASHERS: Record<string, Record<number, CHash>> = {
  sha2: { 224: sha224, 256: sha256, 384: sha384, 512: sha512 },
  sha3: { 224: sha3_224, 256: sha3_256, 384: sha3_384, 512: sha3_512 },
  keccak: { 224: keccak_224, 256: keccak_256, 384: keccak_384, 512: keccak_512 },
  shake: { 128: shake128, 256: shake256 },
  // SHA-512/t 的截断变体用的是不同的初始向量，不能对 SHA-512 的结果做截断
  sha512t: { 224: sha512_224, 256: sha512_256 },
}

/** 画布适配器里带长度后缀的写法。 */
const SUFFIXED_ALIASES: Record<string, CHash> = {
  "sha3-224": sha3_224,
  "sha3-256": sha3_256,
  "sha3-384": sha3_384,
  "sha3-512": sha3_512,
  "keccak-224": keccak_224,
  "keccak-256": keccak_256,
  "keccak-384": keccak_384,
  "keccak-512": keccak_512,
  "shake-128": shake128,
  "shake-256": shake256,
  "sha512-224": sha512_224,
  "sha512-256": sha512_256,
}

/** BLAKE2 的摘要长度由 dkLen 决定，单独建工厂。 */
const BLAKE2_FACTORIES: Record<string, () => { update(b: Uint8Array): unknown; digest(): Uint8Array }> = {
  blake2s256: () => blake2s.create({ dkLen: 32 }),
  blake2b512: () => blake2b.create({ dkLen: 64 }),
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let value = n
    for (let k = 0; k < 8; k += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    }
    table[n] = value >>> 0
  }
  return table
})()

export function updateCrc32(crc: number, bytes: Uint8Array): number {
  let next = crc
  for (const byte of bytes) {
    next = (next >>> 8) ^ CRC32_TABLE[(next ^ byte) & 0xff]
  }
  return next >>> 0
}

/** 基于字节计算，保证文本与文件模式结果一致。 */
export function crc32Bytes(bytes: Uint8Array): number {
  return (updateCrc32(0xffffffff, bytes) ^ -1) >>> 0
}

export function encodeDigest(bytes: Uint8Array, outputFormat: string): string {
  if (outputFormat === "base64") {
    let binary = ""
    for (const byte of bytes) binary += String.fromCharCode(byte)
    return btoa(binary)
  }
  let hex = ""
  for (const byte of bytes) hex += byte.toString(16).padStart(2, "0")
  return hex
}

function resolveNobleHasher(algorithmId: string, digestSize: number): CHash | null {
  const sized = SIZED_HASHERS[algorithmId]
  if (sized) return sized[digestSize] ?? null
  return SUFFIXED_ALIASES[algorithmId] ?? FIXED_HASHERS[algorithmId] ?? null
}

/**
 * 建增量 hasher。所有算法都支持分块 update，因此大文件与"计算全部算法"
 * 都只需遍历一次数据。
 *
 * @param algorithmSize 可配置算法的摘要长度；固定长度算法忽略此值。
 */
export async function createIncrementalHasher(
  algorithmId: string,
  algorithmSize: number | undefined,
  fallbackSize: number,
  outputFormat: string,
): Promise<IncrementalHasher> {
  const digestSize = algorithmSize || fallbackSize

  if (algorithmId === "crc32") {
    let crc = 0xffffffff
    return {
      update: (bytes) => {
        crc = updateCrc32(crc, bytes)
      },
      digest: () => {
        const value = (crc ^ -1) >>> 0
        const bytes = new Uint8Array([value >>> 24, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff])
        return encodeDigest(bytes, outputFormat)
      },
    }
  }

  const blake2 = BLAKE2_FACTORIES[algorithmId]
  if (blake2) {
    const instance = blake2()
    return {
      update: (bytes) => {
        instance.update(bytes)
      },
      digest: () => encodeDigest(instance.digest(), outputFormat),
    }
  }

  if (algorithmId === "sm3") {
    // 只有选到 SM3 时才加载那份 WASM，不进首屏包。
    const { createSM3 } = await import("hash-wasm")
    const hasher = await createSM3()
    return {
      update: (bytes) => {
        hasher.update(bytes)
      },
      digest: () => encodeDigest(hasher.digest("binary"), outputFormat),
    }
  }

  // 工具页用 "sha512" + size 表示 SHA-512/t，适配器用 "sha512-224" 这种写法
  const noble = resolveNobleHasher(algorithmId === "sha512" ? "sha512t" : algorithmId, digestSize)
  if (!noble) throw new Error(`Unsupported hash algorithm: ${algorithmId}`)

  const instance = noble.create()
  return {
    update: (bytes) => {
      instance.update(bytes)
    },
    digest: () => encodeDigest(instance.digest(), outputFormat),
  }
}

/** 一次性计算，供不需要分块的调用方使用。 */
export async function hashBytes(
  data: Uint8Array,
  algorithmId: string,
  algorithmSize: number | undefined,
  outputFormat: string,
): Promise<string> {
  const hasher = await createIncrementalHasher(algorithmId, algorithmSize, algorithmSize ?? 256, outputFormat)
  hasher.update(data)
  return hasher.digest()
}
