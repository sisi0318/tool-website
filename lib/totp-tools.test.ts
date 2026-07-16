import { describe, expect, it } from "vitest"
import { generateTotp, getTotpTimeRemaining, parseOtpauthUri } from "./totp-tools"

describe("TOTP tools", () => {
  it("matches the RFC 6238 SHA-1 test vector", async () => {
    await expect(
      generateTotp("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", 30, 8, 59),
    ).resolves.toBe("94287082")
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
      name: "alice@example.com",
      issuer: "Example",
      secret: "JBSWY3DP",
      period: 60,
      digits: 8,
    })
  })
})
