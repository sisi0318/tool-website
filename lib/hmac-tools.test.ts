import { createHmac, webcrypto } from "node:crypto"
import { describe, expect, it } from "vitest"

import { calculateHmac } from "./hmac-tools"

const message = "The quick brown fox jumps over the lazy dog"

describe("calculateHmac", () => {
  it("uses Web Crypto for SHA-256 and matches the standard vector", async () => {
    await expect(
      calculateHmac(
        {
          data: message,
          key: "key",
          algorithm: "sha256",
          keyFormat: "raw",
          outputFormat: "hex",
        },
        webcrypto.subtle as SubtleCrypto,
      ),
    ).resolves.toBe("f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8")
  })

  it.each(["md5", "sha224", "ripemd160", "sha3-224", "sha3-256", "sha3-384", "sha3-512"])(
    "matches Node's HMAC implementation for %s",
    async (algorithm) => {
      const expected = createHmac(algorithm, "key").update(message).digest("hex")
      await expect(
        calculateHmac({
          data: message,
          key: "key",
          algorithm,
          keyFormat: "raw",
          outputFormat: "hex",
        }),
      ).resolves.toBe(expected)
    },
  )

  it("supports encoded keys and Base64 output", async () => {
    const expected = createHmac("sha512", Buffer.from("6b6579", "hex")).update(message).digest("base64")
    await expect(
      calculateHmac(
        {
          data: message,
          key: "6b6579",
          algorithm: "sha512",
          keyFormat: "hex",
          outputFormat: "base64",
        },
        webcrypto.subtle as SubtleCrypto,
      ),
    ).resolves.toBe(expected)
  })
})
