import { webcrypto } from "node:crypto"
import { describe, expect, it } from "vitest"

import { buildCompositeFingerprint, sha256Hex, stableSerialize } from "./device-fingerprint"

describe("device fingerprint helpers", () => {
  it("creates a standards-compatible SHA-256 digest", async () => {
    await expect(sha256Hex("abc", webcrypto.subtle as SubtleCrypto)).resolves.toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    )
  })

  it("serializes object keys deterministically", () => {
    expect(stableSerialize({ z: 1, nested: { b: 2, a: 1 }, a: [3, 2, 1] })).toBe(
      stableSerialize({ a: [3, 2, 1], nested: { a: 1, b: 2 }, z: 1 }),
    )
  })

  it("keeps the composite id stable regardless of signal key order", async () => {
    const left = await buildCompositeFingerprint({
      canvas: { status: "ready", digest: "canvas" },
      navigator: { status: "ready", digest: "navigator" },
    })
    const right = await buildCompositeFingerprint({
      navigator: { status: "ready", digest: "navigator" },
      canvas: { status: "ready", digest: "canvas" },
    })

    expect(left).toBe(right)
    expect(left).toHaveLength(64)
  })
})
