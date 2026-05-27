import { Hash } from "lucide-react"
import { createHash } from "crypto"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"
import { SHA3, Keccak, SHAKE } from "sha3"

const CATEGORIES = [
  { label: "MD", value: "md" },
  { label: "SHA1", value: "sha1" },
  { label: "SHA2", value: "sha2" },
  { label: "SHA3", value: "sha3" },
  { label: "RIPEMD", value: "ripemd" },
  { label: "BLAKE2", value: "blake2" },
  { label: "SM3", value: "sm3" },
  { label: "CRC", value: "crc" },
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

function crc32Bytes(bytes: Uint8Array): number {
  function makeCRCTable() {
    let c
    const crcTable: number[] = []
    for (let n = 0; n < 256; n++) {
      c = n
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      }
      crcTable[n] = c
    }
    return crcTable
  }

  const crcTable = makeCRCTable()
  let crc = 0 ^ -1

  for (let i = 0; i < bytes.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ bytes[i]) & 0xff]
  }

  return (crc ^ -1) >>> 0
}

function getAlgoNameForCrypto(algorithm: string): string | null {
  const map: Record<string, string> = {
    md5: "md5",
    sha1: "sha1",
    "sha2-224": "sha224",
    "sha2-256": "sha256",
    "sha2-384": "sha384",
    "sha2-512": "sha512",
    "sha512-224": "sha512-224",
    "sha512-256": "sha512-256",
    ripemd160: "ripemd160",
  }
  return map[algorithm] ?? null
}

async function calculateHash(data: string, algorithm: string, outputFormat: string): Promise<string> {
  if (algorithm === "crc32") {
    const bytes = new TextEncoder().encode(data)
    const result = crc32Bytes(bytes).toString(16).padStart(8, "0")
    return outputFormat === "base64" ? Buffer.from(result, "hex").toString("base64") : result
  }

  if (algorithm.startsWith("sha3-") || algorithm.startsWith("keccak-") || algorithm.startsWith("shake-")) {
    const size = parseInt(algorithm.split("-")[1]) as 128 | 224 | 256 | 384 | 512
    let hash: SHA3 | Keccak | SHAKE

    if (algorithm.startsWith("sha3-")) {
      hash = new SHA3(size as 224 | 256 | 384 | 512)
    } else if (algorithm.startsWith("keccak-")) {
      hash = new Keccak(size as 224 | 256 | 384 | 512)
    } else {
      hash = new SHAKE(size as 128 | 256)
    }

    hash.update(data)
    return outputFormat === "base64" ? hash.digest("base64") : hash.digest("hex")
  }

  const cryptoAlgo = getAlgoNameForCrypto(algorithm)
  if (cryptoAlgo) {
    const hash = createHash(cryptoAlgo)
    hash.update(data)
    return outputFormat === "base64" ? hash.digest("base64") : hash.digest("hex")
  }

  const formData = new FormData()
  formData.append("algorithm", algorithm)
  formData.append("outputFormat", outputFormat)
  formData.append("text", data)

  const response = await fetch("/api/hash", {
    method: "POST",
    body: formData,
  })

  if (!response.ok) {
    throw new Error(`Hash API responded with ${response.status}`)
  }

  const result = await response.json()
  return result.result
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
