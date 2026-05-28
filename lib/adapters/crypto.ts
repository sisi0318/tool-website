import { Shield } from "lucide-react"
import CryptoJS from "crypto-js"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"

export const cryptoAdapter: ToolAdapter = {
  type: "crypto",
  category: "crypto",
  label: "Crypto",
  icon: Shield,
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
      id: "iv",
      name: "IV",
      dataType: "string",
      defaultValue: "",
      hasInput: true,
      hasOutput: true,
      visible: (config) => config.mode !== "ECB",
    },
    {
      id: "algorithm",
      name: "Algorithm",
      dataType: "string",
      defaultValue: "aes",
      options: [
        { label: "AES", value: "aes" },
        { label: "DES", value: "des" },
        { label: "TripleDES", value: "tripledes" },
      ],
      hasInput: true,
      hasOutput: true,
    },
    {
      id: "mode",
      name: "Mode",
      dataType: "string",
      defaultValue: "CBC",
      options: [
        { label: "CBC", value: "CBC" },
        { label: "ECB", value: "ECB" },
        { label: "CFB", value: "CFB" },
        { label: "OFB", value: "OFB" },
        { label: "CTR", value: "CTR" },
      ],
      hasInput: true,
      hasOutput: true,
    },
    {
      id: "operation",
      name: "Operation",
      dataType: "string",
      defaultValue: "encrypt",
      options: [
        { label: "Encrypt", value: "encrypt" },
        { label: "Decrypt", value: "decrypt" },
      ],
      hasInput: true,
      hasOutput: true,
    },
  ],
  outputs: [
    { id: "result", name: "Result", dataType: "string" },
  ],
  async execute(inputs, config) {
    const data = String(inputs.data ?? config.data ?? "")
    const key = String(inputs.key ?? config.key ?? "")
    const iv = String(inputs.iv ?? config.iv ?? "")
    const algorithm = String(inputs.algorithm ?? config.algorithm ?? "aes")
    const mode = String(inputs.mode ?? config.mode ?? "CBC")
    const operation = String(inputs.operation ?? config.operation ?? "encrypt")

    if (!data) throw new Error("Data is required")
    if (!key) throw new Error("Key is required")

    const algoMap: Record<string, typeof CryptoJS.AES> = {
      aes: CryptoJS.AES,
      des: CryptoJS.DES,
      tripledes: CryptoJS.TripleDES,
    }

    const modeMap: Record<string, typeof CryptoJS.mode.CBC> = {
      CBC: CryptoJS.mode.CBC,
      ECB: CryptoJS.mode.ECB,
      CFB: CryptoJS.mode.CFB,
      OFB: CryptoJS.mode.OFB,
      CTR: CryptoJS.mode.CTR,
    }

    const cipher = algoMap[algorithm]
    const cipherMode = modeMap[mode]

    if (!cipher) throw new Error(`Unsupported algorithm: ${algorithm}`)
    if (!cipherMode) throw new Error(`Unsupported mode: ${mode}`)

    const keyParsed = CryptoJS.enc.Utf8.parse(key)
    const ivParsed = iv ? CryptoJS.enc.Utf8.parse(iv) : undefined

    const options: CryptoJS.CipherOption = {
      mode: cipherMode,
      padding: CryptoJS.pad.Pkcs7,
    }

    if (ivParsed && mode !== "ECB") {
      options.iv = ivParsed
    }

    try {
      if (operation === "encrypt") {
        const encrypted = cipher.encrypt(data, keyParsed, options)
        return { result: encrypted.toString() }
      } else {
        const decrypted = cipher.decrypt(data, keyParsed, options)
        return { result: decrypted.toString(CryptoJS.enc.Utf8) }
      }
    } catch (error) {
      throw new Error(`Crypto error: ${error}`)
    }
  },
}

export function registerCryptoAdapter(): void {
  registerNode(cryptoAdapter)
}
