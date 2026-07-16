import { describe, expect, it } from "vitest"

import { bytesToCryptoWordArray, cryptoWordArrayToBytes } from "./crypto-js-bytes"

describe("CryptoJS binary conversion", () => {
  it("preserves arbitrary bytes including invalid UTF-8 sequences", () => {
    const source = Uint8Array.from([0, 1, 127, 128, 194, 255, 10])

    expect(cryptoWordArrayToBytes(bytesToCryptoWordArray(source))).toEqual(source)
  })
})
