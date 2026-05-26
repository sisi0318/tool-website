import { Hash } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"
import { createHash } from "crypto"

const ALGORITHMS = [
  { label: "MD5", value: "md5" },
  { label: "SHA-1", value: "sha1" },
  { label: "SHA-256", value: "sha256" },
  { label: "SHA-384", value: "sha384" },
  { label: "SHA-512", value: "sha512" },
]

export const hashAdapter: ToolAdapter = {
  type: "hash",
  category: "crypto",
  label: "Hash",
  icon: Hash,
  inputs: [{ id: "data", name: "Data", dataType: "string", required: true }],
  outputs: [
    { id: "hash", name: "Hash", dataType: "string" },
    { id: "algorithm", name: "Algorithm", dataType: "string" },
  ],
  config: [
    {
      id: "algorithm",
      name: "Algorithm",
      dataType: "string",
      defaultValue: "sha256",
      options: ALGORITHMS,
    },
  ],
  async execute(inputs, config) {
    const data = String(inputs.data ?? "")
    const algorithm = String(config.algorithm ?? "sha256")

    try {
      const hash = createHash(algorithm)
      hash.update(data)
      const result = hash.digest("hex")
      return { hash: result, algorithm }
    } catch (error) {
      throw new Error(`Hash error: ${error}`)
    }
  },
}

export function registerHashAdapter(): void {
  registerNode(hashAdapter)
}
