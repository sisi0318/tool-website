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
      id: "algorithm",
      name: "Algorithm",
      dataType: "string",
      defaultValue: "caesar",
      options: [
        { label: "Caesar", value: "caesar" },
        { label: "ROT13", value: "rot13" },
        { label: "Atbash", value: "atbash" },
        { label: "Vigenere", value: "vigenere" },
        { label: "Playfair", value: "playfair" },
        { label: "Rail Fence", value: "rail-fence" },
        { label: "Columnar", value: "columnar" },
        { label: "Affine", value: "affine" },
      ],
    },
    {
      id: "shift",
      name: "Shift",
      dataType: "number",
      defaultValue: 3,
      dependsOn: "algorithm",
      dynamicOptions: (algorithm) => algorithm === "caesar" ? [{ label: "1-25", value: "1-25" }] : [],
    },
    {
      id: "key",
      name: "Key",
      dataType: "string",
      defaultValue: "",
      dependsOn: "algorithm",
      dynamicOptions: (algorithm) => ["vigenere", "playfair"].includes(algorithm) ? [{ label: "Key", value: "key" }] : [],
    },
    {
      id: "railCount",
      name: "Rails",
      dataType: "number",
      defaultValue: 3,
      dependsOn: "algorithm",
      dynamicOptions: (algorithm) => algorithm === "rail-fence" ? [{ label: "2-10", value: "2-10" }] : [],
    },
    {
      id: "colKey",
      name: "Column Key",
      dataType: "string",
      defaultValue: "",
      dependsOn: "algorithm",
      dynamicOptions: (algorithm) => algorithm === "columnar" ? [{ label: "Key", value: "key" }] : [],
    },
    {
      id: "affineA",
      name: "Affine A",
      dataType: "number",
      defaultValue: 5,
      dependsOn: "algorithm",
      dynamicOptions: (algorithm) => algorithm === "affine" ? [{ label: "1-25", value: "1-25" }] : [],
    },
    {
      id: "affineB",
      name: "Affine B",
      dataType: "number",
      defaultValue: 8,
      dependsOn: "algorithm",
      dynamicOptions: (algorithm) => algorithm === "affine" ? [{ label: "0-25", value: "0-25" }] : [],
    },
  ],
  async execute(inputs, config) {
    const data = String(inputs.data ?? "")
    const algorithm = String(config.algorithm ?? "caesar")
    const shift = Number(config.shift ?? 3)

    switch (algorithm) {
      case "caesar":
        return { result: caesarCipher(data, shift) }
      case "rot13":
        return { result: rot13(data) }
      case "atbash":
        return { result: data.split("").map((c) => {
          if (c >= "a" && c <= "z") return String.fromCharCode(219 - c.charCodeAt(0))
          if (c >= "A" && c <= "Z") return String.fromCharCode(155 - c.charCodeAt(0))
          return c
        }).join("") }
      default:
        return { result: caesarCipher(data, shift) }
    }
  },
}

export function registerClassicCipherAdapter(): void {
  registerNode(classicCipherAdapter)
}
