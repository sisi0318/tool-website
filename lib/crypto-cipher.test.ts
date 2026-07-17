import { describe, expect, it } from "vitest"
import {
  decryptCryptoWordArray,
  encryptCryptoWordArray,
  type SupportedCryptoAlgorithm,
} from "./crypto-cipher"
import {
  bytesToCryptoWordArray,
  cryptoWordArrayToBytes,
} from "./crypto-js-bytes"

function roundTrip(
  algorithm: SupportedCryptoAlgorithm,
  mode: string,
  key: Uint8Array,
  iv: Uint8Array | null,
) {
  const source = Uint8Array.from([0, 1, 2, 127, 128, 254, 255, 10, 11])
  const encrypted = encryptCryptoWordArray(
    algorithm,
    bytesToCryptoWordArray(source),
    bytesToCryptoWordArray(key),
    iv ? bytesToCryptoWordArray(iv) : null,
    mode,
  )
  const decrypted = decryptCryptoWordArray(
    algorithm,
    encrypted,
    bytesToCryptoWordArray(key),
    iv ? bytesToCryptoWordArray(iv) : null,
    mode,
  )
  expect(cryptoWordArrayToBytes(decrypted)).toEqual(source)
}

describe("crypto cipher", () => {
  it("round-trips AES-CBC binary data", () => {
    roundTrip("aes", "CBC", new Uint8Array(32).fill(7), new Uint8Array(16).fill(9))
  })

  it("round-trips DES-CBC using an 8-byte IV", () => {
    roundTrip("des", "CBC", new Uint8Array(8).fill(3), new Uint8Array(8).fill(5))
  })

  it("round-trips AES-CFB data without block padding", () => {
    roundTrip("aes", "CFB", new Uint8Array(16).fill(11), new Uint8Array(16).fill(13))
  })

  it("round-trips RC4 stream data without an IV", () => {
    roundTrip("rc4", "Stream", new Uint8Array(16).fill(17), null)
  })
})
