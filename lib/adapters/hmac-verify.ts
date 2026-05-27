import { Key } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"
import { hmacAdapter } from "./hmac"

export const hmacVerifyAdapter: ToolAdapter = {
  type: "hmac-verify",
  category: "crypto",
  label: "HMAC Verify",
  icon: Key,
  config: [
    {
      id: "expectedHmac",
      name: "Expected HMAC",
      dataType: "string",
      defaultValue: "",
      hasInput: true,
      hasOutput: false,
    },
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
      hasInput: false,
      hasOutput: false,
    },
  ],
  outputs: [
    { id: "valid", name: "Valid", dataType: "boolean" },
  ],
  async execute(inputs, config) {
    const expectedHmac = String(inputs.expectedHmac ?? config.expectedHmac ?? "")
    const data = String(inputs.data ?? config.data ?? "")
    const key = String(inputs.key ?? config.key ?? "")
    const algorithm = String(inputs.algorithm ?? config.algorithm ?? "sha256")

    if (!expectedHmac) {
      return { valid: false }
    }

    const result = await hmacAdapter.execute(
      { data, key },
      { algorithm, outputFormat: "hex" }
    )

    const computedHmac = result.hmac as string
    return { valid: computedHmac.toLowerCase() === expectedHmac.toLowerCase() }
  },
}

export function registerHmacVerifyAdapter(): void {
  registerNode(hmacVerifyAdapter)
}
