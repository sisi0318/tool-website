import CryptoJS from "crypto-js"
import { SHA3 } from "sha3"

import { base64ToBytes, bytesToBase64, bytesToHex, hexToBytes } from "./binary"
import { bytesToCryptoWordArray, cryptoWordArrayToBytes } from "./crypto-js-bytes"

export type HmacKeyFormat = "raw" | "hex" | "base64"
export type HmacOutputFormat = "hex" | "base64"

export interface HmacOptions {
  data: string
  key: string
  algorithm: string
  keyFormat: HmacKeyFormat
  outputFormat: HmacOutputFormat
}

const WEB_CRYPTO_ALGORITHMS: Record<string, string> = {
  sha1: "SHA-1",
  sha256: "SHA-256",
  sha384: "SHA-384",
  sha512: "SHA-512",
}

const SHA3_BLOCK_SIZES: Record<number, number> = {
  224: 144,
  256: 136,
  384: 104,
  512: 72,
}

function decodeKey(key: string, format: HmacKeyFormat): Uint8Array {
  if (format === "hex") return hexToBytes(key)
  if (format === "base64") return base64ToBytes(key)
  return new TextEncoder().encode(key)
}

function sha3Digest(size: 224 | 256 | 384 | 512, parts: Uint8Array[]): Uint8Array {
  const hash = new SHA3(size)
  for (const part of parts) {
    hash.update(bytesToBase64(part), "base64")
  }
  return Uint8Array.from(hash.digest())
}

function calculateSha3Hmac(
  dataBytes: Uint8Array,
  keyBytes: Uint8Array,
  size: 224 | 256 | 384 | 512,
): Uint8Array {
  const blockSize = SHA3_BLOCK_SIZES[size]
  let normalizedKey = keyBytes

  if (normalizedKey.length > blockSize) {
    normalizedKey = sha3Digest(size, [normalizedKey])
  }

  const paddedKey = new Uint8Array(blockSize)
  paddedKey.set(normalizedKey)
  const innerKey = new Uint8Array(blockSize)
  const outerKey = new Uint8Array(blockSize)

  for (let index = 0; index < blockSize; index += 1) {
    innerKey[index] = paddedKey[index] ^ 0x36
    outerKey[index] = paddedKey[index] ^ 0x5c
  }

  const innerDigest = sha3Digest(size, [innerKey, dataBytes])
  return sha3Digest(size, [outerKey, innerDigest])
}

function calculateLegacyHmac(
  dataBytes: Uint8Array,
  keyBytes: Uint8Array,
  algorithm: "md5" | "sha224" | "ripemd160",
): Uint8Array {
  const data = bytesToCryptoWordArray(dataBytes)
  const key = bytesToCryptoWordArray(keyBytes)
  const digest =
    algorithm === "md5"
      ? CryptoJS.HmacMD5(data, key)
      : algorithm === "sha224"
        ? CryptoJS.HmacSHA224(data, key)
        : CryptoJS.HmacRIPEMD160(data, key)

  return cryptoWordArrayToBytes(digest)
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
  } else if (options.algorithm.startsWith("sha3-")) {
    const size = Number.parseInt(options.algorithm.slice(5), 10)
    if (![224, 256, 384, 512].includes(size)) {
      throw new Error(`不支持的 HMAC 算法: ${options.algorithm}`)
    }
    digest = calculateSha3Hmac(dataBytes, keyBytes, size as 224 | 256 | 384 | 512)
  } else if (["md5", "sha224", "ripemd160"].includes(options.algorithm)) {
    digest = calculateLegacyHmac(
      dataBytes,
      keyBytes,
      options.algorithm as "md5" | "sha224" | "ripemd160",
    )
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
