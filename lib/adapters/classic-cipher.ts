import { Lock } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"

function caesarCipher(text: string, shift: number): string {
  return text.replace(/[a-zA-Z]/g, (char) => {
    const base = char <= "Z" ? 65 : 97
    return String.fromCharCode(((char.charCodeAt(0) - base + shift) % 26) + base)
  })
}

function rot13(text: string): string {
  return caesarCipher(text, 13)
}

export const classicCipherAdapter: ToolAdapter = {
  type: "classic-cipher",
  category: "crypto",
  label: "Classic Cipher",
  icon: Lock,
  config: [
    {
      id: "data",
      name: "Data",
      dataType: "string",
      defaultValue: "",
      hasInput: true,
      hasOutput: false,
    },
    {
      id: "algorithm",
      name: "Algorithm",
      dataType: "string",
      defaultValue: "caesar",
      options: [
        { label: "Caesar", value: "caesar" },
        { label: "ROT13", value: "rot13" },
        { label: "Atbash", value: "atbash" },
      ],
      hasInput: true,
      hasOutput: true,
    },
    {
      id: "shift",
      name: "Shift",
      dataType: "number",
      defaultValue: 3,
      slider: { min: 1, max: 25, step: 1 },
      visible: (config) => config.algorithm === "caesar",
      hasInput: true,
      hasOutput: true,
    },
  ],
  outputs: [
    { id: "result", name: "Result", dataType: "string" },
  ],
  async execute(inputs, config) {
    const data = String(inputs.data ?? config.data ?? "")
    const algorithm = String(inputs.algorithm ?? config.algorithm ?? "caesar")
    const shift = Number(inputs.shift ?? config.shift ?? 3)

    switch (algorithm) {
      case "caesar":
        return { result: caesarCipher(data, shift) }
      case "rot13":
        return { result: rot13(data) }
      case "atbash":
        return {
          result: data.split("").map((c) => {
            if (c >= "a" && c <= "z") return String.fromCharCode(219 - c.charCodeAt(0))
            if (c >= "A" && c <= "Z") return String.fromCharCode(155 - c.charCodeAt(0))
            return c
          }).join(""),
        }
      default:
        return { result: caesarCipher(data, shift) }
    }
  },
}

export function registerClassicCipherAdapter(): void {
  registerNode(classicCipherAdapter)
}
