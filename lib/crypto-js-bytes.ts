import CryptoJS from "crypto-js"

export function bytesToCryptoWordArray(bytes: Uint8Array): CryptoJS.lib.WordArray {
  const words: number[] = []

  for (let index = 0; index < bytes.length; index += 1) {
    words[index >>> 2] = (words[index >>> 2] ?? 0) | (bytes[index] << (24 - (index % 4) * 8))
  }

  return CryptoJS.lib.WordArray.create(words, bytes.length)
}

export function cryptoWordArrayToBytes(wordArray: CryptoJS.lib.WordArray): Uint8Array {
  const bytes = new Uint8Array(wordArray.sigBytes)

  for (let index = 0; index < wordArray.sigBytes; index += 1) {
    bytes[index] = (wordArray.words[index >>> 2] >>> (24 - (index % 4) * 8)) & 0xff
  }

  return bytes
}
