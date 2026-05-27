import { Key } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"
import { createHmac } from "crypto"

export const hmacAdapter: ToolAdapter = {
  type: "hmac",
  category: "crypto",
  label: "HMAC",
  icon: Key,
  inputs: [
    { id: "data", name: "Data", dataType: "string", required: true },
    { id: "key", name: "Key", dataType: "string", required: true },
  ],
  outputs: [
    { id: "hmac", name: "HMAC", dataType: "string" },
  ],
  config: [
    {
      id: "algorithm",
      name: "Algorithm",
      dataType: "string",
      defaultValue: "sha256",
      options: [
        { label: "MD5", value: "md5" },
        { label: "SHA-1", value: "sha1" },
        { label: "SHA-224", value: "sha224" },
        { label: "SHA-256", value: "sha256" },
        { label: "SHA-384", value: "sha384" },
        { label: "SHA-512", value: "sha512" },
        { label: "SHA3-256", value: "sha3-256" },
        { label: "SHA3-512", value: "sha3-512" },
        { label: "RIPEMD-160", value: "ripemd160" },
      ],
    },
    {
      id: "keyFormat",
      name: "Key Format",
      dataType: "string",
      defaultValue: "raw",
      options: [
        { label: "Raw", value: "raw" },
        { label: "Hex", value: "hex" },
        { label: "Base64", value: "base64" },
      ],
    },
    {
      id: "outputFormat",
      name: "Output",
      dataType: "string",
      defaultValue: "hex",
      options: [
        { label: "Hex", value: "hex" },
        { label: "Base64", value: "base64" },
      ],
    },
  ],
  async execute(inputs, config) {
    const data = String(inputs.data ?? "")
    const key = String(inputs.key ?? "")
    const algorithm = String(config.algorithm ?? "sha256")

    try {
      const hmac = createHmac(algorithm, key)
      hmac.update(data)
      return { hmac: hmac.digest("hex") }
    } catch (error) {
      throw new Error(`HMAC error: ${error}`)
    }
  },
}

export function registerHmacAdapter(): void {
  registerNode(hmacAdapter)
}
