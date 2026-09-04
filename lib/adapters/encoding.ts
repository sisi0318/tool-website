import { ArrowLeftRight } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"
import { transformEncoding, type EncodingType } from "../encoding-tools"

/**
 * 下拉里的每个选项都必须能映射到 lib/encoding-tools 的实现。
 * 早期这里维护了一份自己的 encode/decode,其中 7 种编码没有对应 case,
 * 会静默原样返回,punycode 也不是 RFC 3492;现在统一复用工具页那套。
 */
const ENCODING_TYPES: Array<{ label: string; value: EncodingType }> = [
  { label: "Base64", value: "base64" },
  { label: "URL", value: "url" },
  { label: "HEX", value: "hex" },
  { label: "HTML", value: "html" },
  { label: "Unicode", value: "unicode" },
  { label: "UTF-8", value: "utf8" },
  { label: "ASCII", value: "ascii" },
  { label: "Base32", value: "base32" },
  { label: "Binary", value: "binary" },
  { label: "Morse", value: "morse" },
  { label: "ROT13", value: "rot13" },
  { label: "Base58", value: "base58" },
  { label: "Base85", value: "base85" },
  { label: "Octal", value: "octal" },
  { label: "Punycode", value: "punycode" },
  { label: "Quoted-Printable", value: "quoted" },
]

const SUPPORTED_ENCODINGS = new Set<string>(ENCODING_TYPES.map((entry) => entry.value))

export const encodingAdapter: ToolAdapter = {
  type: "encoding",
  category: "crypto",
  label: "Encoding",
  icon: ArrowLeftRight,
  config: [
    {
      id: "input",
      name: "Input",
      dataType: "string",
      defaultValue: "",
      hasInput: true,
      hasOutput: false,
    },
    {
      id: "encoding",
      name: "Encoding",
      dataType: "string",
      defaultValue: "base64",
      options: ENCODING_TYPES,
      hasInput: true,
      hasOutput: true,
    },
    {
      id: "mode",
      name: "Mode",
      dataType: "string",
      defaultValue: "encode",
      options: [
        { label: "Encode", value: "encode" },
        { label: "Decode", value: "decode" },
      ],
      hasInput: true,
      hasOutput: true,
    },
  ],
  outputs: [
    { id: "output", name: "Output", dataType: "string" },
  ],
  async execute(inputs, config) {
    const input = String(inputs.input ?? config.input ?? "")
    const encoding = String(inputs.encoding ?? config.encoding ?? "base64")
    const mode = String(inputs.mode ?? config.mode ?? "encode")

    // 旧配置里可能存着 "quoted-printable",保持兼容。
    const normalized = encoding === "quoted-printable" ? "quoted" : encoding
    if (!SUPPORTED_ENCODINGS.has(normalized)) {
      throw new Error(`Unsupported encoding: ${encoding}`)
    }

    try {
      return {
        output: transformEncoding(
          input,
          normalized as EncodingType,
          mode === "decode" ? "decode" : "encode",
        ),
      }
    } catch (error) {
      throw new Error(`Encoding error: ${error instanceof Error ? error.message : String(error)}`)
    }
  },
}

export function registerEncodingAdapter(): void {
  registerNode(encodingAdapter)
}
