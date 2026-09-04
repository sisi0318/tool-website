import { hmac } from "@noble/hashes/hmac.js"
import { md5, ripemd160 } from "@noble/hashes/legacy.js"
import { sha224 } from "@noble/hashes/sha2.js"
import { sha3_224, sha3_256, sha3_384, sha3_512 } from "@noble/hashes/sha3.js"
import type { CHash } from "@noble/hashes/utils.js"

import { base64ToBytes, bytesToBase64, bytesToHex, hexToBytes } from "./binary"

export type HmacKeyFormat = "raw" | "hex" | "base64"
export type HmacOutputFormat = "hex" | "base64"

export interface HmacOptions {
  data: string
  key: string
  algorithm: string
  keyFormat: HmacKeyFormat
  outputFormat: HmacOutputFormat
}

/** 浏览器原生支持的算法优先走 Web Crypto。 */
const WEB_CRYPTO_ALGORITHMS: Record<string, string> = {
  sha1: "SHA-1",
  sha256: "SHA-256",
  sha384: "SHA-384",
  sha512: "SHA-512",
}

/**
 * Web Crypto 覆盖不到的算法。此前 SHA-3 的 HMAC 是在这里手写 ipad/opad 与
 * 分组长度表拼出来的，md5 / sha224 / ripemd160 则依赖已停止维护的 crypto-js；
 * 现在统一交给 @noble/hashes 的 hmac 实现。
 */
const NOBLE_ALGORITHMS: Record<string, CHash> = {
  md5,
  sha224,
  ripemd160,
  "sha3-224": sha3_224,
  "sha3-256": sha3_256,
  "sha3-384": sha3_384,
  "sha3-512": sha3_512,
}

function decodeKey(key: string, format: HmacKeyFormat): Uint8Array {
  if (format === "hex") return hexToBytes(key)
  if (format === "base64") return base64ToBytes(key)
  return new TextEncoder().encode(key)
}

export async function calculateHmac(
  options: HmacOptions,
  subtle: SubtleCrypto | undefined = globalThis.crypto?.subtle,
): Promise<string> {
  const dataBytes = new TextEncoder().encode(options.data)
  const keyBytes = decodeKey(options.key, options.keyFormat)
  const webCryptoAlgorithm = WEB_CRYPTO_ALGORITHMS[options.algorithm]
  let digest: Uint8Array

  if (webCryptoAlgorithm) {
    if (!subtle) throw new Error("当前环境不支持 Web Crypto HMAC")
    const keyMaterial = Uint8Array.from(keyBytes).buffer as ArrayBuffer
    const message = Uint8Array.from(dataBytes).buffer as ArrayBuffer
    const cryptoKey = await subtle.importKey(
      "raw",
      keyMaterial,
      { name: "HMAC", hash: webCryptoAlgorithm },
      false,
      ["sign"],
    )
    digest = new Uint8Array(await subtle.sign("HMAC", cryptoKey, message))
  } else if (NOBLE_ALGORITHMS[options.algorithm]) {
    digest = hmac(NOBLE_ALGORITHMS[options.algorithm], keyBytes, dataBytes)
  } else {
    throw new Error(`不支持的 HMAC 算法: ${options.algorithm}`)
  }

  return options.outputFormat === "base64" ? bytesToBase64(digest) : bytesToHex(digest)
}

export function verifyHmac(
  expected: string,
  candidate: string,
  outputFormat: HmacOutputFormat,
): boolean {
  const normalize = (value: string) => {
    const trimmed = value.trim()
    return outputFormat === "hex" ? trimmed.toLowerCase() : trimmed
  }
  const normalizedExpected = normalize(expected)
  const normalizedCandidate = normalize(candidate)
  const length = Math.max(normalizedExpected.length, normalizedCandidate.length)
  let difference = normalizedExpected.length ^ normalizedCandidate.length

  for (let index = 0; index < length; index += 1) {
    difference |=
      (normalizedExpected.charCodeAt(index) || 0) ^
      (normalizedCandidate.charCodeAt(index) || 0)
  }

  return difference === 0
}
