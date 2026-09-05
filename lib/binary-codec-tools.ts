import { base64ToBytes, bytesToBase64, bytesToHex, hexToBytes } from "./binary"
import { BINARY_CODEC_LIMITS, BinaryCodecError, decodeBinaryJson, encodeBinaryJson, parseBinaryJson, stringifyBinaryJson, type BinaryCodecFormat, type BinaryJson } from "./binary-codecs"

export interface BinaryCodecOptions { format: BinaryCodecFormat; operation: "encode" | "decode"; encoding: "hex" | "base64"; signal?: AbortSignal }
export interface BinaryCodecResult { output: string; value: BinaryJson; file: File; byteLength: number }
export async function processBinaryCodec(input: string | File, options: BinaryCodecOptions): Promise<BinaryCodecResult> {
  if (!["encode", "decode"].includes(options.operation) || !["hex", "base64"].includes(options.encoding)) throw new BinaryCodecError("invalidFormat")
  options.signal?.throwIfAborted()
  let bytes: Uint8Array<ArrayBuffer>, value: BinaryJson, output: string
  if (options.operation === "encode") {
    if (typeof input !== "string") throw new BinaryCodecError("invalidJson")
    value = parseBinaryJson(input)
    bytes = encodeBinaryJson(value, options.format)
    output = options.encoding === "hex" ? bytesToHex(bytes) : bytesToBase64(bytes)
  } else {
    if (typeof input === "string") {
      if (input.length > BINARY_CODEC_LIMITS.bytes * 3) throw new BinaryCodecError("limit")
      try { bytes = new Uint8Array(options.encoding === "hex" ? hexToBytes(input) : base64ToBytes(input)) } catch { throw new BinaryCodecError("invalidData") }
    } else {
      if (input.size > BINARY_CODEC_LIMITS.bytes) throw new BinaryCodecError("limit")
      bytes = new Uint8Array(await input.arrayBuffer())
      options.signal?.throwIfAborted()
    }
    value = decodeBinaryJson(bytes, options.format)
    output = stringifyBinaryJson(value)
  }
  options.signal?.throwIfAborted()
  return { output, value, byteLength: bytes.byteLength, file: new File([bytes], options.format === "cbor" ? "data.cbor" : "data.msgpack", { type: options.format === "cbor" ? "application/cbor" : "application/msgpack" }) }
}
