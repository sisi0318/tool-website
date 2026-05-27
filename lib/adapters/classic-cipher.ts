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

function base64Encode(text: string): string {
  return Buffer.from(text).toString("base64")
}

function base64Decode(text: string): string {
  return Buffer.from(text, "base64").toString("utf8")
}

export const classicCipherAdapter: ToolAdapter = {
  type: "classic-cipher",
  category: "crypto",
  label: "Classic Cipher",
  icon: Lock,
  inputs: [
    { id: "data", name: "Data", dataType: "string", required: true },
  ],
  outputs: [
    { id: "result", name: "Result", dataType: "string" },
  ],
  config: [
    {
      id: "cipher",
      name: "Cipher",
      dataType: "string",
      defaultValue: "caesar",
      options: [
        { label: "Caesar", value: "caesar" },
        { label: "ROT13", value: "rot13" },
        { label: "Base64 Encode", value: "base64-encode" },
        { label: "Base64 Decode", value: "base64-decode" },
      ],
    },
    {
      id: "shift",
      name: "Shift",
      dataType: "number",
      defaultValue: 3,
    },
  ],
  async execute(inputs, config) {
    const data = String(inputs.data ?? "")
    const cipher = String(config.cipher ?? "caesar")
    const shift = Number(config.shift ?? 3)

    switch (cipher) {
      case "caesar":
        return { result: caesarCipher(data, shift) }
      case "rot13":
        return { result: rot13(data) }
      case "base64-encode":
        return { result: base64Encode(data) }
      case "base64-decode":
        return { result: base64Decode(data) }
      default:
        throw new Error(`Unknown cipher: ${cipher}`)
    }
  },
}

export function registerClassicCipherAdapter(): void {
  registerNode(classicCipherAdapter)
}
