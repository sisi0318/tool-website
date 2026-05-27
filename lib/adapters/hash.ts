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
  { label: "SHA3", value: "sha3" },
  { label: "RIPEMD-160", value: "ripemd160" },
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
    {
      id: "variant",
      name: "Variant",
      dataType: "string",
      defaultValue: "sha3-256",
      dependsOn: "algorithm",
      dynamicOptions: (algorithm) => {
        if (algorithm === "sha3") {
          return [
            { label: "SHA3-256", value: "sha3-256" },
            { label: "SHA3-384", value: "sha3-384" },
            { label: "SHA3-512", value: "sha3-512" },
            { label: "SHAKE128", value: "shake128" },
            { label: "SHAKE256", value: "shake256" },
          ]
        }
        return []
      },
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
