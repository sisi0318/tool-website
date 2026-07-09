import { Key } from "lucide-react"
import CryptoJS from "crypto-js"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"

export const hmacAdapter: ToolAdapter = {
  type: "hmac",
  category: "crypto",
  label: "HMAC",
  icon: Key,
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
      id: "key",
      name: "Key",
      dataType: "string",
      defaultValue: "",
      hasInput: true,
      hasOutput: false,
    },
    {
      id: "algorithm",
      name: "Algorithm",
      dataType: "string",
      defaultValue: "sha256",
      options: [
        { label: "MD5", value: "md5" },
        { label: "SHA-1", value: "sha1" },
        { label: "SHA-256", value: "sha256" },
        { label: "SHA-384", value: "sha384" },
        { label: "SHA-512", value: "sha512" },
      ],
      hasInput: true,
      hasOutput: true,
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
      hasInput: true,
      hasOutput: true,
    },
  ],
  outputs: [
    { id: "hmac", name: "HMAC", dataType: "string" },
  ],
  async execute(inputs, config) {
    const data = String(inputs.data ?? config.data ?? "")
    const key = String(inputs.key ?? config.key ?? "")
    const algorithm = String(inputs.algorithm ?? config.algorithm ?? "sha256")
    const outputFormat = String(inputs.outputFormat ?? config.outputFormat ?? "hex")

    try {
      const hashers: Record<string, (message: string, secret: string) => { toString: (encoder?: unknown) => string }> = {
        md5: CryptoJS.HmacMD5,
        sha1: CryptoJS.HmacSHA1,
        sha256: CryptoJS.HmacSHA256,
        sha384: CryptoJS.HmacSHA384,
        sha512: CryptoJS.HmacSHA512,
      }
      const hasher = hashers[algorithm]
      if (!hasher) throw new Error(`Unsupported algorithm: ${algorithm}`)
      const result = hasher(data, key)
      return {
        hmac: result.toString(outputFormat === "base64" ? CryptoJS.enc.Base64 : CryptoJS.enc.Hex),
      }
    } catch (error) {
      throw new Error(`HMAC error: ${error}`)
    }
  },
}

export function registerHmacAdapter(): void {
  registerNode(hmacAdapter)
}
