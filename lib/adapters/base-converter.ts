import { Binary } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"

const BASES = [
  { label: "Binary (2)", value: "2" },
  { label: "Octal (8)", value: "8" },
  { label: "Decimal (10)", value: "10" },
  { label: "Hexadecimal (16)", value: "16" },
]

export const baseConverterAdapter: ToolAdapter = {
  type: "base-converter",
  category: "utility",
  label: "Base Converter",
  icon: Binary,
  inputs: [{ id: "value", name: "Value", dataType: "string", required: true }],
  outputs: [
    { id: "binary", name: "Binary", dataType: "string" },
    { id: "octal", name: "Octal", dataType: "string" },
    { id: "decimal", name: "Decimal", dataType: "string" },
    { id: "hex", name: "Hex", dataType: "string" },
  ],
  config: [
    {
      id: "fromBase",
      name: "Input Base",
      dataType: "string",
      defaultValue: "10",
      options: BASES,
    },
  ],
  async execute(inputs, config) {
    const value = String(inputs.value ?? "").trim()
    const fromBase = Number(config.fromBase ?? 10)

    try {
      const decimal = parseInt(value, fromBase)
      if (isNaN(decimal)) throw new Error("Invalid number")

      return {
        binary: decimal.toString(2),
        octal: decimal.toString(8),
        decimal: decimal.toString(10),
        hex: decimal.toString(16).toUpperCase(),
      }
    } catch (error) {
      throw new Error(`Base conversion error: ${error}`)
    }
  },
}

export function registerBaseConverterAdapter(): void {
  registerNode(baseConverterAdapter)
}
