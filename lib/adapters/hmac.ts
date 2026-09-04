import { Key } from "lucide-react"
import { hmac } from "@noble/hashes/hmac.js"
import { md5, sha1 } from "@noble/hashes/legacy.js"
import { sha256, sha384, sha512 } from "@noble/hashes/sha2.js"
import type { CHash } from "@noble/hashes/utils.js"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"
import { encodeDigest } from "../hash-algorithms"

const HMAC_HASHERS: Record<string, CHash> = { md5, sha1, sha256, sha384, sha512 }

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
      const hasher = HMAC_HASHERS[algorithm]
      if (!hasher) throw new Error(`Unsupported algorithm: ${algorithm}`)
      const encoder = new TextEncoder()
      const digest = hmac(hasher, encoder.encode(key), encoder.encode(data))
      return { hmac: encodeDigest(digest, outputFormat) }
    } catch (error) {
      throw new Error(`HMAC error: ${error}`)
    }
  },
}

export function registerHmacAdapter(): void {
  registerNode(hmacAdapter)
}
