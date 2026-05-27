import { Shield } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"
import { createCipheriv, createDecipheriv, randomBytes } from "crypto"

export const cryptoAdapter: ToolAdapter = {
  type: "crypto",
  category: "crypto",
  label: "Crypto",
  icon: Shield,
  inputs: [
    { id: "data", name: "Data", dataType: "string", required: true },
    { id: "key", name: "Key", dataType: "string", required: true },
  ],
  outputs: [
    { id: "result", name: "Result", dataType: "string" },
  ],
  config: [
    {
      id: "algorithm",
      name: "Algorithm",
      dataType: "string",
      defaultValue: "aes-256-cbc",
      options: [
        { label: "AES-256-CBC", value: "aes-256-cbc" },
        { label: "AES-128-CBC", value: "aes-128-cbc" },
        { label: "DES-CBC", value: "des-cbc" },
      ],
    },
    {
      id: "mode",
      name: "Mode",
      dataType: "string",
      defaultValue: "encrypt",
      options: [
        { label: "Encrypt", value: "encrypt" },
        { label: "Decrypt", value: "decrypt" },
      ],
    },
  ],
  async execute(inputs, config) {
    const data = String(inputs.data ?? "")
    const key = String(inputs.key ?? "")
    const algorithm = String(config.algorithm ?? "aes-256-cbc")
    const mode = String(config.mode ?? "encrypt")

    try {
      const iv = randomBytes(16)
      if (mode === "encrypt") {
        const cipher = createCipheriv(algorithm, Buffer.from(key.padEnd(32, "0").slice(0, 32)), iv)
        let encrypted = cipher.update(data, "utf8", "hex")
        encrypted += cipher.final("hex")
        return { result: iv.toString("hex") + ":" + encrypted }
      } else {
        const parts = data.split(":")
        const decipher = createDecipheriv(algorithm, Buffer.from(key.padEnd(32, "0").slice(0, 32)), Buffer.from(parts[0], "hex"))
        let decrypted = decipher.update(parts[1], "hex", "utf8")
        decrypted += decipher.final("utf8")
        return { result: decrypted }
      }
    } catch (error) {
      throw new Error(`Crypto error: ${error}`)
    }
  },
}

export function registerCryptoAdapter(): void {
  registerNode(cryptoAdapter)
}
