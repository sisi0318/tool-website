import { Hash } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"
import { hashBytes } from "../hash-algorithms"

const CATEGORIES = [
  { label: "MD5", value: "md" },
  { label: "SHA-1", value: "sha1" },
  { label: "SHA-2", value: "sha2" },
  { label: "SHA-3", value: "sha3" },
  { label: "RIPEMD-160", value: "ripemd" },
  { label: "BLAKE2", value: "blake2" },
  { label: "SM3", value: "sm3" },
  { label: "CRC32", value: "crc" },
]

const ALGORITHM_MAP: Record<string, Array<{ label: string; value: string }>> = {
  md: [{ label: "MD5", value: "md5" }],
  sha1: [{ label: "SHA-1", value: "sha1" }],
  sha2: [
    { label: "SHA-2-224", value: "sha2-224" },
    { label: "SHA-2-256", value: "sha2-256" },
    { label: "SHA-2-384", value: "sha2-384" },
    { label: "SHA-2-512", value: "sha2-512" },
    { label: "SHA-512/t-224", value: "sha512-224" },
    { label: "SHA-512/t-256", value: "sha512-256" },
  ],
  sha3: [
    { label: "SHA-3/NIST-224", value: "sha3-224" },
    { label: "SHA-3/NIST-256", value: "sha3-256" },
    { label: "SHA-3/NIST-384", value: "sha3-384" },
    { label: "SHA-3/NIST-512", value: "sha3-512" },
    { label: "Keccak-224", value: "keccak-224" },
    { label: "Keccak-256", value: "keccak-256" },
    { label: "Keccak-384", value: "keccak-384" },
    { label: "Keccak-512", value: "keccak-512" },
    { label: "SHAKE-128", value: "shake-128" },
    { label: "SHAKE-256", value: "shake-256" },
  ],
  ripemd: [{ label: "RIPEMD-160", value: "ripemd160" }],
  blake2: [
    { label: "BLAKE2s-256", value: "blake2s256" },
    { label: "BLAKE2b-512", value: "blake2b512" },
  ],
  sm3: [{ label: "SM3", value: "sm3" }],
  crc: [{ label: "CRC32", value: "crc32" }],
}

async function calculateHash(data: string, algorithm: string, outputFormat: string): Promise<string> {
  return hashBytes(new TextEncoder().encode(data), algorithm, undefined, outputFormat)
}

export const hashAdapter: ToolAdapter = {
  type: "hash",
  category: "crypto",
  label: "Hash",
  icon: Hash,
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
      id: "category",
      name: "Category",
      dataType: "string",
      defaultValue: "md",
      options: CATEGORIES,
      hasInput: false,
      hasOutput: false,
    },
    {
      id: "algorithm",
      name: "Algorithm",
      dataType: "string",
      defaultValue: "md5",
      dependsOn: "category",
      dynamicOptions: (category) => ALGORITHM_MAP[category] ?? [],
      hasInput: false,
      hasOutput: false,
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
      hasInput: false,
      hasOutput: true,
    },
  ],
  outputs: [
    { id: "hash", name: "Hash", dataType: "string" },
  ],
  async execute(inputs, config) {
    const data = String(inputs.data ?? config.data ?? "")
    const algorithm = String(inputs.algorithm ?? config.algorithm ?? "md5")
    const outputFormat = String(inputs.outputFormat ?? config.outputFormat ?? "hex")

    try {
      const hash = await calculateHash(data, algorithm, outputFormat)
      return { hash }
    } catch (error) {
      throw new Error(`Hash error: ${error}`)
    }
  },
}

export function registerHashAdapter(): void {
  registerNode(hashAdapter)
}
