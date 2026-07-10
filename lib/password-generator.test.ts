import { describe, expect, it } from "vitest"

import {
  calculatePassphraseEntropy,
  calculatePasswordEntropy,
  generatePassphrase,
  generatePassword,
  getPasswordPoolSize,
  getPasswordStrength,
  type PasswordOptions,
} from "./password-generator"

const defaults: PasswordOptions = {
  length: 32,
  lowercase: true,
  uppercase: true,
  numbers: true,
  symbols: true,
  excludeAmbiguous: false,
}

describe("password generator", () => {
  it("uses every enabled character group", () => {
    const password = generatePassword(defaults)
    expect(password).toHaveLength(32)
    expect(password).toMatch(/[a-z]/)
    expect(password).toMatch(/[A-Z]/)
    expect(password).toMatch(/[0-9]/)
    expect(password).toMatch(/[!@#$%^&*()\-_=+\[\]{};:,.?]/)
  })

  it("can exclude ambiguous characters", () => {
    const password = generatePassword({ ...defaults, length: 128, excludeAmbiguous: true })
    expect(password).not.toMatch(/[Il1O0o|`'"]/)
  })

  it("rejects invalid character settings", () => {
    expect(() => generatePassword({ ...defaults, lowercase: false, uppercase: false, numbers: false, symbols: false })).toThrow("NO_CHARACTER_SET")
    expect(() => generatePassword({ ...defaults, length: 2 })).toThrow("INVALID_PASSWORD_LENGTH")
  })

  it("generates readable compound passphrases", () => {
    const phrase = generatePassphrase({ wordCount: 4, separator: ".", capitalize: true, includeNumber: true })
    expect(phrase.split(".")).toHaveLength(4)
    expect(phrase).toMatch(/\d{2}$/)
  })

  it("calculates entropy and strength bands", () => {
    const entropy = calculatePasswordEntropy(16, getPasswordPoolSize(defaults))
    expect(entropy).toBeGreaterThan(90)
    expect(getPasswordStrength(entropy)).toBe("strong")
    expect(getPasswordStrength(35)).toBe("weak")
    expect(calculatePassphraseEntropy(4, false)).toBe(60)
  })
})
