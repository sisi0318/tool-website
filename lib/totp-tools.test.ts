import { describe, expect, it } from "vitest"
import { generateTotp, getTotpTimeRemaining, normalizeBase32Secret, parseOtpauthUri } from "./totp-tools"

// RFC 6238 Appendix B seeds ("1234567890" repeated to 20, 32 and 64 bytes), Base32 encoded.
const SHA1_SEED = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"
const SHA256_SEED = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZA"
const SHA512_SEED = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNA"

describe("TOTP tools", () => {
  it("matches the RFC 6238 SHA-1 test vector", async () => {
    await expect(generateTotp(SHA1_SEED, 30, 8, 59)).resolves.toBe("94287082")
  })

  it("matches the RFC 6238 SHA-256 and SHA-512 test vectors", async () => {
    await expect(generateTotp(SHA256_SEED, 30, 8, 59, "SHA256")).resolves.toBe("46119246")
    await expect(generateTotp(SHA512_SEED, 30, 8, 59, "SHA512")).resolves.toBe("90693936")
    await expect(generateTotp(SHA256_SEED, 30, 8, 1111111109, "SHA256")).resolves.toBe("68084774")
    await expect(generateTotp(SHA512_SEED, 30, 8, 1111111109, "SHA512")).resolves.toBe("25091201")
  })

  it("calculates remaining time from each account period", () => {
    expect(getTotpTimeRemaining(41, 30)).toBe(19)
    expect(getTotpTimeRemaining(41, 60)).toBe(19)
    expect(getTotpTimeRemaining(60, 60)).toBe(60)
    expect(getTotpTimeRemaining(41, 15)).toBe(4)
  })

  it("parses issuer, account name and custom timing from an otpauth URI", () => {
    expect(
      parseOtpauthUri(
        "otpauth://totp/Example%3Aalice%40example.com?secret=jbsw-y3dp&issuer=Example&period=60&digits=8",
      ),
    ).toEqual({
      ok: true,
      account: {
        name: "alice@example.com",
        issuer: "Example",
        secret: "JBSWY3DP",
        period: 60,
        digits: 8,
        algorithm: "SHA1",
      },
    })
  })

  it("keeps the algorithm from the URI instead of silently falling back to SHA-1", () => {
    const result = parseOtpauthUri(`otpauth://totp/Svc:bob?secret=${SHA256_SEED}&algorithm=sha256`)
    expect(result.ok && result.account.algorithm).toBe("SHA256")
    expect(parseOtpauthUri(`otpauth://totp/Svc:bob?secret=${SHA1_SEED}&algorithm=SHA-512`)).toMatchObject({ ok: true, account: { algorithm: "SHA512" } })
    expect(parseOtpauthUri(`otpauth://totp/Svc:bob?secret=${SHA1_SEED}&algorithm=MD5`)).toEqual({ ok: false, error: "unsupportedAlgorithm", detail: "MD5" })
  })

  it("reports why an otpauth URI cannot be imported", () => {
    expect(parseOtpauthUri("not a uri")).toEqual({ ok: false, error: "invalidUri" })
    expect(parseOtpauthUri(`otpauth://hotp/Svc:bob?secret=${SHA1_SEED}&counter=1`)).toEqual({ ok: false, error: "unsupportedType", detail: "hotp" })
    expect(parseOtpauthUri("otpauth://totp/Svc:bob?issuer=Svc")).toEqual({ ok: false, error: "missingSecret" })
    expect(parseOtpauthUri("otpauth://totp/Svc:bob?secret=JBSWY3DP0HPK1PXP")).toEqual({ ok: false, error: "invalidSecret", detail: "0 1" })
  })
})

describe("normalizeBase32Secret", () => {
  it("drops grouping spaces, hyphens and padding", () => {
    expect(normalizeBase32Secret("jbsw y3dp-ehpk 3pxp==")).toEqual({ ok: true, secret: "JBSWY3DPEHPK3PXP" })
  })

  it("reports characters outside the Base32 alphabet instead of deleting them", () => {
    expect(normalizeBase32Secret("JBSW Y3D8 0HPK")).toEqual({ ok: false, invalidCharacters: ["8", "0"] })
  })
})
