import { KeyRound } from "lucide-react"

import { registerNode } from "../canvas/registry"
import { calculatePasswordEntropy, generatePassword, getPasswordPoolSize, type PasswordOptions } from "../password-generator"
import type { ToolAdapter } from "./types"

function asBoolean(value: unknown, fallback: boolean): boolean {
  if (value === undefined || value === null) return fallback
  return value === true || value === "true"
}

export const passwordGeneratorAdapter: ToolAdapter = {
  type: "password-generator",
  category: "crypto",
  label: "Password Generator",
  icon: KeyRound,
  config: [
    { id: "length", name: "Length", dataType: "number", defaultValue: 20, slider: { min: 4, max: 64, step: 1 }, hasInput: true, hasOutput: true },
    { id: "lowercase", name: "Lowercase", dataType: "boolean", defaultValue: true, hasInput: true, hasOutput: false },
    { id: "uppercase", name: "Uppercase", dataType: "boolean", defaultValue: true, hasInput: true, hasOutput: false },
    { id: "numbers", name: "Numbers", dataType: "boolean", defaultValue: true, hasInput: true, hasOutput: false },
    { id: "symbols", name: "Symbols", dataType: "boolean", defaultValue: true, hasInput: true, hasOutput: false },
    { id: "avoidAmbiguous", name: "Avoid ambiguous", dataType: "boolean", defaultValue: true, hasInput: true, hasOutput: false },
  ],
  outputs: [
    { id: "password", name: "Password", dataType: "string" },
    { id: "entropy", name: "Entropy", dataType: "number" },
  ],
  async execute(inputs, config) {
    const options: PasswordOptions = {
      length: Number(inputs.length ?? config.length ?? 20),
      lowercase: asBoolean(inputs.lowercase ?? config.lowercase, true),
      uppercase: asBoolean(inputs.uppercase ?? config.uppercase, true),
      numbers: asBoolean(inputs.numbers ?? config.numbers, true),
      symbols: asBoolean(inputs.symbols ?? config.symbols, true),
      excludeAmbiguous: asBoolean(inputs.avoidAmbiguous ?? config.avoidAmbiguous, true),
    }
    return {
      password: generatePassword(options),
      entropy: Math.round(calculatePasswordEntropy(options.length, getPasswordPoolSize(options))),
    }
  },
}

export function registerPasswordGeneratorAdapter(): void {
  registerNode(passwordGeneratorAdapter)
}
