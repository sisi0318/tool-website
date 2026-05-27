import { Hash } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"
import { hashAdapter } from "./hash"

export const hashVerifyAdapter: ToolAdapter = {
  type: "hash-verify",
  category: "crypto",
  label: "Hash Verify",
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
      id: "hash",
      name: "Hash",
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
      options: [
        { label: "MD", value: "md" },
        { label: "SHA1", value: "sha1" },
        { label: "SHA2", value: "sha2" },
        { label: "SHA3", value: "sha3" },
        { label: "RIPEMD", value: "ripemd" },
        { label: "BLAKE2", value: "blake2" },
        { label: "SM3", value: "sm3" },
        { label: "CRC", value: "crc" },
      ],
      hasInput: false,
      hasOutput: false,
    },
    {
      id: "algorithm",
      name: "Algorithm",
      dataType: "string",
      defaultValue: "md5",
      dependsOn: "category",
      dynamicOptions: (category) => {
        const map: Record<string, Array<{ label: string; value: string }>> = {
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
        return map[category] ?? []
      },
      hasInput: false,
      hasOutput: false,
    },
  ],
  outputs: [
    { id: "valid", name: "Valid", dataType: "boolean" },
  ],
  async execute(inputs, config) {
    const data = String(inputs.data ?? config.data ?? "")
    const expectedHash = String(inputs.hash ?? config.hash ?? "")
    const algorithm = String(inputs.algorithm ?? config.algorithm ?? "md5")

    if (!expectedHash) {
      return { valid: false }
    }

    const result = await hashAdapter.execute(
      { data },
      { algorithm, outputFormat: "hex" }
    )

    const computedHash = result.hash as string
    return { valid: computedHash.toLowerCase() === expectedHash.toLowerCase() }
  },
}

export function registerHashVerifyAdapter(): void {
  registerNode(hashVerifyAdapter)
}
