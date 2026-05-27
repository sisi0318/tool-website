import { Shield } from "lucide-react"
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
    const algorithm = String(inputs.algorithm ?? config.algorithm ?? "aes")
    const mode = String(inputs.mode ?? config.mode ?? "CBC")
    const operation = String(inputs.operation ?? config.operation ?? "encrypt")

    if (!data) throw new Error("Data is required")
    if (!key) throw new Error("Key is required")

    return {
      result: `[${operation.toUpperCase()}] ${algorithm}-${mode}: ${data.substring(0, 20)}...`,
      note: "Full crypto requires CryptoJS library",
    }
  },
}

export function registerCryptoAdapter(): void {
  registerNode(cryptoAdapter)
}
