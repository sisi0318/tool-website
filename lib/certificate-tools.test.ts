import { describe, expect, it } from "vitest"
import { inspectCryptoMaterial } from "./certificate-tools"

describe("certificate and key inspector", () => {
  it("summarizes a public JWK", async () => {
    const result = await inspectCryptoMaterial(JSON.stringify({ kty: "EC", crv: "P-256", x: "abc", y: "def", kid: "key-1" }))
    expect(result).toMatchObject({ kind: "JSON Web Key", summary: { kty: "EC", curve: "P-256", kid: "key-1", hasPrivateMaterial: false } })
  })

  it("detects private JWK fields without returning their values", async () => {
    const secret = "do-not-display"
    const result = await inspectCryptoMaterial(JSON.stringify({ kty: "oct", k: secret }))
    expect(result.warnings.length).toBe(1)
    expect(JSON.stringify(result)).not.toContain(secret)
  })

  it("rejects arbitrary JSON objects and incomplete JWK entries", async () => {
    await expect(inspectCryptoMaterial('{"name":"not-a-key"}')).rejects.toThrow("kty")
    await expect(inspectCryptoMaterial('{"kty":"RSA","n":"abc"}')).rejects.toThrow("missing")
  })

  it("does not decode private PEM key material", async () => {
    const result = await inspectCryptoMaterial("-----BEGIN PRIVATE KEY-----\nAQID\n-----END PRIVATE KEY-----")
    expect(result).toMatchObject({ kind: "Private key container", summary: { byteLength: 3 } })
    expect(result.warnings[0]).toMatch(/intentionally/)
  })

  it("accepts legacy PEM encryption headers", async () => {
    const pem = "-----BEGIN RSA PRIVATE KEY-----\nProc-Type: 4,ENCRYPTED\nDEK-Info: AES-256-CBC,0123456789ABCDEF\n\nAQID\n-----END RSA PRIVATE KEY-----"
    const result = await inspectCryptoMaterial(pem)
    expect(result).toMatchObject({ kind: "Private key container", summary: { encrypted: true, byteLength: 3 } })
  })

  it("does not silently discard invalid PEM payload lines containing a colon", async () => {
    await expect(
      inspectCryptoMaterial("-----BEGIN PRIVATE KEY-----\nAQ:ID\n-----END PRIVATE KEY-----"),
    ).rejects.toThrow("Invalid Base64")
  })
})
