import { base64ToBytes, bytesToBase64, hexToBytes } from "./binary"

// Wire formats: https://github.com/msgpack/msgpack/blob/master/spec.md
// https://www.rfc-editor.org/rfc/rfc8949.html
export type BinaryCodecFormat = "msgpack" | "cbor"
export type BinaryJson = null | boolean | number | string | BinaryJson[] | { [key: string]: BinaryJson }
export const BINARY_CODEC_LIMITS = { bytes: 8 * 1024 * 1024, jsonChars: 16 * 1024 * 1024, values: 100_000, depth: 64, bigintDigits: 5000 } as const
export class BinaryCodecError extends Error {
  constructor(public code: "limit" | "truncated" | "invalidFormat" | "invalidData" | "invalidUtf8" | "invalidJson" | "unsafeNumber" | "invalidTag" | "integerRange" | "unsupportedType" | "trailingData", public offset = 0) { super(`${code} @ ${offset}`); this.name = "BinaryCodecError" }
}
const ZERO = BigInt(0), ONE = BigInt(1), U64 = BigInt("18446744073709551615"), I64_MIN = BigInt("-9223372036854775808")
const RESERVED = new Set(["$binary", "$bigint", "$number", "$undefined", "$map", "$object", "$msgpackExt", "$msgpackString", "$cborTag", "$cborSimple"])
function isRecord(value: unknown): value is Record<string, BinaryJson> { return !!value && typeof value === "object" && !Array.isArray(value) }
function floatJson(value: number): BinaryJson { return !Number.isFinite(value) || Number.isInteger(value) || Object.is(value, -0) ? { $number: Object.is(value, -0) ? "-0" : String(value) } : value }
function integerJson(value: bigint, forceBig = false): BinaryJson { return forceBig || value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER) ? { $bigint: value.toString() } : Number(value) }
function mapJson(entries: BinaryJson[][]): BinaryJson {
  if (!entries.every(([key]) => typeof key === "string") || new Set(entries.map(([key]) => key)).size !== entries.length) return { $map: entries }
  const object = Object.fromEntries(entries as Array<[string, BinaryJson]>)
  return entries.length === 1 && RESERVED.has(String(entries[0][0])) ? { $object: object } : object
}
function parseBytes(value: BinaryJson): Uint8Array {
  if (typeof value !== "string") throw new BinaryCodecError("invalidTag")
  let bytes: Uint8Array
  try { bytes = base64ToBytes(value) } catch { throw new BinaryCodecError("invalidTag") }
  if (bytes.length > BINARY_CODEC_LIMITS.bytes) throw new BinaryCodecError("limit")
  return bytes
}
function encodeUtf8(value: string): Uint8Array {
  let bytes = 0
  for (let index = 0; index < value.length; index++) {
    const unit = value.charCodeAt(index)
    if (unit >= 0xd800 && unit <= 0xdbff) { const next = value.charCodeAt(++index); if (!(next >= 0xdc00 && next <= 0xdfff)) throw new BinaryCodecError("invalidUtf8"); bytes += 4 }
    else if (unit >= 0xdc00 && unit <= 0xdfff) throw new BinaryCodecError("invalidUtf8")
    else bytes += unit < 0x80 ? 1 : unit < 0x800 ? 2 : 3
    if (bytes > BINARY_CODEC_LIMITS.bytes) throw new BinaryCodecError("limit")
  }
  return new TextEncoder().encode(value)
}

class Reader {
  pos = 0
  values = 0
  view: DataView
  constructor(public bytes: Uint8Array) { this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength) }
  fail(code: BinaryCodecError["code"]): never { throw new BinaryCodecError(code, this.pos) }
  need(length: number) { if (!Number.isSafeInteger(length) || length < 0 || length > this.bytes.length - this.pos) this.fail("truncated") }
  byte() { this.need(1); return this.bytes[this.pos++] }
  peek() { this.need(1); return this.bytes[this.pos] }
  take(length: number) { this.need(length); const bytes = this.bytes.subarray(this.pos, this.pos + length); this.pos += length; return bytes }
  uint(width: number): number { this.need(width); const value = width === 1 ? this.view.getUint8(this.pos) : width === 2 ? this.view.getUint16(this.pos) : this.view.getUint32(this.pos); this.pos += width; return value }
  signed(width: number): number { this.need(width); const value = width === 1 ? this.view.getInt8(this.pos) : width === 2 ? this.view.getInt16(this.pos) : this.view.getInt32(this.pos); this.pos += width; return value }
  bigint(signed = false): bigint { this.need(8); const value = signed ? this.view.getBigInt64(this.pos) : this.view.getBigUint64(this.pos); this.pos += 8; return value }
  float(width: number): BinaryJson {
    this.need(width)
    if (width === 2) { const bits = this.uint(2), sign = bits & 0x8000 ? -1 : 1, exponent = bits >>> 10 & 31, fraction = bits & 1023; return floatJson(exponent === 31 ? fraction ? NaN : sign * Infinity : exponent === 0 ? sign * 2 ** -14 * (fraction / 1024) : sign * 2 ** (exponent - 15) * (1 + fraction / 1024)) }
    const value = width === 4 ? this.view.getFloat32(this.pos) : this.view.getFloat64(this.pos); this.pos += width; return floatJson(value)
  }
  count(depth: number) { if (++this.values > BINARY_CODEC_LIMITS.values || depth > BINARY_CODEC_LIMITS.depth) this.fail("limit") }
  text(length: number, msgpack: boolean): BinaryJson {
    const raw = this.take(length)
    try { return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(raw) }
    catch { if (msgpack) return { $msgpackString: bytesToBase64(raw) }; return this.fail("invalidUtf8") }
  }
  container(length: number, map: boolean, depth: number, read: (depth: number) => BinaryJson): BinaryJson {
    const values = length * (map ? 2 : 1)
    if (!Number.isSafeInteger(values) || values > BINARY_CODEC_LIMITS.values - this.values) this.fail("limit")
    this.need(values)
    if (map) { const entries: BinaryJson[][] = []; for (let index = 0; index < length; index++) entries.push([read(depth + 1), read(depth + 1)]); return mapJson(entries) }
    const array: BinaryJson[] = []; for (let index = 0; index < length; index++) array.push(read(depth + 1)); return array
  }
  msgpack = (depth = 0): BinaryJson => {
    this.count(depth)
    const code = this.byte()
    if (code <= 0x7f) return code
    if (code >= 0xe0) return code - 256
    if (code >= 0xa0 && code <= 0xbf) return this.text(code & 31, true)
    if (code >= 0x90 && code <= 0x9f) return this.container(code & 15, false, depth, this.msgpack)
    if (code >= 0x80 && code <= 0x8f) return this.container(code & 15, true, depth, this.msgpack)
    if (code === 0xc0) return null
    if (code === 0xc2 || code === 0xc3) return code === 0xc3
    if (code >= 0xc4 && code <= 0xc6) return { $binary: bytesToBase64(this.take(this.uint(2 ** (code - 0xc4)))) }
    if ((code >= 0xc7 && code <= 0xc9) || (code >= 0xd4 && code <= 0xd8)) {
      const length = code <= 0xc9 ? this.uint(2 ** (code - 0xc7)) : 2 ** (code - 0xd4), type = this.signed(1)
      return { $msgpackExt: { type, data: bytesToBase64(this.take(length)) } }
    }
    if (code === 0xca || code === 0xcb) return this.float(code === 0xca ? 4 : 8)
    if (code >= 0xcc && code <= 0xce) return this.uint(2 ** (code - 0xcc))
    if (code === 0xcf) return integerJson(this.bigint(), true)
    if (code >= 0xd0 && code <= 0xd2) return this.signed(2 ** (code - 0xd0))
    if (code === 0xd3) return integerJson(this.bigint(true), true)
    if (code >= 0xd9 && code <= 0xdb) return this.text(this.uint(2 ** (code - 0xd9)), true)
    if (code === 0xdc || code === 0xdd) return this.container(this.uint(code === 0xdc ? 2 : 4), false, depth, this.msgpack)
    if (code === 0xde || code === 0xdf) return this.container(this.uint(code === 0xde ? 2 : 4), true, depth, this.msgpack)
    return this.fail("invalidData")
  }
  argument(additional: number): bigint {
    if (additional < 24) return BigInt(additional)
    if (additional <= 26) return BigInt(this.uint(2 ** (additional - 24)))
    if (additional === 27) return this.bigint()
    return this.fail("invalidData")
  }
  length(value: bigint): number { if (value > BigInt(BINARY_CODEC_LIMITS.bytes)) this.fail("limit"); return Number(value) }
  cbor = (depth = 0): BinaryJson => {
    this.count(depth)
    const code = this.byte(), major = code >>> 5, additional = code & 31
    if (major === 7) {
      if (additional < 20) return { $cborSimple: additional }
      if (additional === 20 || additional === 21) return additional === 21
      if (additional === 22) return null
      if (additional === 23) return { $undefined: true }
      if (additional === 24) { const value = this.byte(); if (value < 32) return this.fail("invalidData"); return { $cborSimple: value } }
      if (additional >= 25 && additional <= 27) return this.float(2 ** (additional - 24))
      return this.fail("invalidData")
    }
    if (additional === 31) {
      if (major === 2 || major === 3) {
        const chunks: Uint8Array[] = [], strings: string[] = []
        let length = 0
        while (this.peek() !== 0xff) {
          this.count(depth + 1)
          const header = this.byte()
          if (header >>> 5 !== major || (header & 31) === 31) return this.fail("invalidData")
          const size = this.length(this.argument(header & 31)); length += size
          if (length > BINARY_CODEC_LIMITS.bytes) this.fail("limit")
          if (major === 3) strings.push(this.text(size, false) as string); else chunks.push(this.take(size))
        }
        this.byte()
        if (major === 3) return strings.join("")
        const bytes = new Uint8Array(length); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
        return { $binary: bytesToBase64(bytes) }
      }
      if (major === 4) { const array: BinaryJson[] = []; while (this.peek() !== 0xff) array.push(this.cbor(depth + 1)); this.byte(); return array }
      if (major === 5) { const entries: BinaryJson[][] = []; while (this.peek() !== 0xff) { const key = this.cbor(depth + 1); if (this.peek() === 0xff) return this.fail("invalidData"); entries.push([key, this.cbor(depth + 1)]) }; this.byte(); return mapJson(entries) }
      return this.fail("invalidData")
    }
    const argument = this.argument(additional)
    if (major === 0 || major === 1) return integerJson(major === 0 ? argument : -ONE - argument, additional === 27)
    if (major === 2) return { $binary: bytesToBase64(this.take(this.length(argument))) }
    if (major === 3) return this.text(this.length(argument), false)
    if (major === 4 || major === 5) return this.container(this.length(argument), major === 5, depth, this.cbor)
    if (major === 6) {
      const value = this.cbor(depth + 1)
      if ((argument === BigInt(2) || argument === BigInt(3)) && isRecord(value) && Object.keys(value).length === 1 && typeof value.$binary === "string" && value.$binary.length <= 2732) {
        const bytes = base64ToBytes(value.$binary)
        if (bytes.length <= 2048) { let number = ZERO; for (const byte of bytes) number = number * BigInt(256) + BigInt(byte); return { $bigint: (argument === BigInt(2) ? number : -ONE - number).toString() } }
      }
      return { $cborTag: { tag: argument.toString(), value } }
    }
    return this.fail("invalidData")
  }
}

class Writer {
  private bytes = new Uint8Array(1024)
  private pos = 0
  private ensure(length: number) {
    if (this.pos + length > BINARY_CODEC_LIMITS.bytes) throw new BinaryCodecError("limit")
    if (this.pos + length > this.bytes.length) { const next = new Uint8Array(Math.min(BINARY_CODEC_LIMITS.bytes, Math.max(this.pos + length, this.bytes.length * 2))); next.set(this.bytes); this.bytes = next }
  }
  byte(value: number) { this.ensure(1); this.bytes[this.pos++] = value }
  raw(bytes: Uint8Array) { this.ensure(bytes.length); this.bytes.set(bytes, this.pos); this.pos += bytes.length }
  uint(value: number, width: number) { this.ensure(width); const view = new DataView(this.bytes.buffer); if (width === 1) view.setUint8(this.pos, value); else if (width === 2) view.setUint16(this.pos, value); else view.setUint32(this.pos, value); this.pos += width }
  big(value: bigint) { this.ensure(8); new DataView(this.bytes.buffer).setBigUint64(this.pos, BigInt.asUintN(64, value)); this.pos += 8 }
  float(value: number) { this.ensure(8); new DataView(this.bytes.buffer).setFloat64(this.pos, value); this.pos += 8 }
  finish() { return this.bytes.slice(0, this.pos) }
}

class Encoder {
  writer = new Writer()
  values = 0
  active = new WeakSet<object>()
  constructor(private format: BinaryCodecFormat) {}
  cborHead(major: number, value: bigint, force64 = false) {
    if (value < ZERO || value > U64) throw new BinaryCodecError("integerRange")
    const high = major << 5
    if (force64 || value > BigInt(0xffffffff)) { this.writer.byte(high | 27); this.writer.big(value) }
    else if (value < BigInt(24)) this.writer.byte(high | Number(value))
    else if (value <= BigInt(0xff)) { this.writer.byte(high | 24); this.writer.uint(Number(value), 1) }
    else if (value <= BigInt(0xffff)) { this.writer.byte(high | 25); this.writer.uint(Number(value), 2) }
    else { this.writer.byte(high | 26); this.writer.uint(Number(value), 4) }
  }
  header(length: number, type: "array" | "map" | "string" | "binary") {
    if (this.format === "cbor") { this.cborHead(type === "binary" ? 2 : type === "string" ? 3 : type === "array" ? 4 : 5, BigInt(length)); return }
    const fixed = type === "string" ? 32 : type === "binary" ? 0 : 16
    if (length < fixed) { this.writer.byte((type === "string" ? 0xa0 : type === "array" ? 0x90 : 0x80) | length); return }
    const width = length <= 255 && (type === "string" || type === "binary") ? 1 : length <= 65535 ? 2 : 4
    const marker = type === "string" ? width === 1 ? 0xd9 : width === 2 ? 0xda : 0xdb : type === "binary" ? width === 1 ? 0xc4 : width === 2 ? 0xc5 : 0xc6 : type === "array" ? width === 2 ? 0xdc : 0xdd : width === 2 ? 0xde : 0xdf
    this.writer.byte(marker); this.writer.uint(length, width)
  }
  integer(value: bigint, force64 = false) {
    if (this.format === "cbor") {
      const negative = value < ZERO, magnitude = negative ? -ONE - value : value
      if (magnitude <= U64) { this.cborHead(negative ? 1 : 0, magnitude, force64); return }
      this.cborHead(6, BigInt(negative ? 3 : 2))
      let hex = magnitude.toString(16); if (hex.length % 2) hex = "0" + hex
      const bytes = hexToBytes(hex); this.header(bytes.length, "binary"); this.writer.raw(bytes); return
    }
    if (value < I64_MIN || value > U64) throw new BinaryCodecError("integerRange")
    if (force64 || value > BigInt(0xffffffff) || value < BigInt(-2147483648)) { this.writer.byte(value >= ZERO ? 0xcf : 0xd3); this.writer.big(value); return }
    const number = Number(value)
    if (number >= -32 && number <= 127) this.writer.byte(number & 255)
    else if (number >= 0) { const width = number <= 255 ? 1 : number <= 65535 ? 2 : 4; this.writer.byte(width === 1 ? 0xcc : width === 2 ? 0xcd : 0xce); this.writer.uint(number, width) }
    else { const width = number >= -128 ? 1 : number >= -32768 ? 2 : 4; this.writer.byte(width === 1 ? 0xd0 : width === 2 ? 0xd1 : 0xd2); this.writer.uint(number, width) }
  }
  map(entries: Array<[BinaryJson, BinaryJson]>, depth: number) { this.header(entries.length, "map"); for (const [key, value] of entries) { this.value(key, depth + 1); this.value(value, depth + 1) } }
  value(value: BinaryJson, depth = 0, literalObject = false): void {
    if (++this.values > BINARY_CODEC_LIMITS.values || depth > BINARY_CODEC_LIMITS.depth) throw new BinaryCodecError("limit")
    if (value === null) { this.writer.byte(this.format === "cbor" ? 0xf6 : 0xc0); return }
    if (typeof value === "boolean") { this.writer.byte(this.format === "cbor" ? value ? 0xf5 : 0xf4 : value ? 0xc3 : 0xc2); return }
    if (typeof value === "number") {
      if (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value))) throw new BinaryCodecError("unsafeNumber")
      if (Number.isInteger(value) && !Object.is(value, -0)) this.integer(BigInt(value))
      else { this.writer.byte(this.format === "cbor" ? 0xfb : 0xcb); this.writer.float(value) }
      return
    }
    if (typeof value === "string") {
      const bytes = encodeUtf8(value); this.header(bytes.length, "string"); this.writer.raw(bytes); return
    }
    if (!value || typeof value !== "object" || this.active.has(value)) throw new BinaryCodecError("invalidJson")
    if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) throw new BinaryCodecError("invalidJson")
    this.active.add(value)
    try {
      if (Array.isArray(value)) { this.header(value.length, "array"); for (const child of value) this.value(child, depth + 1); return }
      const keys = Object.keys(value), key = keys[0], payload = value[key]
      if (!literalObject && keys.length === 1 && RESERVED.has(key)) {
        if (key === "$object") { if (!isRecord(payload)) throw new BinaryCodecError("invalidTag"); this.value(payload, depth, true); return }
        if (key === "$binary" || key === "$msgpackString") {
          if (key === "$msgpackString" && this.format !== "msgpack") throw new BinaryCodecError("unsupportedType")
          const bytes = parseBytes(payload); this.header(bytes.length, key === "$binary" ? "binary" : "string"); this.writer.raw(bytes); return
        }
        if (key === "$bigint") {
          if (typeof payload !== "string" || !/^-?(?:0|[1-9]\d*)$/.test(payload) || payload.replace(/^-/, "").length > BINARY_CODEC_LIMITS.bigintDigits) throw new BinaryCodecError("invalidTag")
          this.integer(BigInt(payload), true); return
        }
        if (key === "$number") {
          if (typeof payload !== "string" || (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(payload) && !["NaN", "Infinity", "-Infinity"].includes(payload))) throw new BinaryCodecError("invalidTag")
          const number = Number(payload)
          if (!Number.isFinite(number) && !["NaN", "Infinity", "-Infinity"].includes(payload)) throw new BinaryCodecError("invalidTag")
          this.writer.byte(this.format === "cbor" ? 0xfb : 0xcb); this.writer.float(number); return
        }
        if (key === "$map") {
          if (!Array.isArray(payload) || !payload.every((entry) => Array.isArray(entry) && entry.length === 2)) throw new BinaryCodecError("invalidTag")
          this.map(payload as Array<[BinaryJson, BinaryJson]>, depth); return
        }
        if (key === "$msgpackExt") {
          if (this.format !== "msgpack") throw new BinaryCodecError("unsupportedType")
          if (!isRecord(payload) || Object.keys(payload).length !== 2 || typeof payload.type !== "number" || !Number.isInteger(payload.type) || payload.type < -128 || payload.type > 127 || !Object.hasOwn(payload, "data")) throw new BinaryCodecError("invalidTag")
          const bytes = parseBytes(payload.data), fixed = [1, 2, 4, 8, 16].indexOf(bytes.length)
          if (fixed >= 0) this.writer.byte(0xd4 + fixed)
          else { const width = bytes.length <= 255 ? 1 : bytes.length <= 65535 ? 2 : 4; this.writer.byte(width === 1 ? 0xc7 : width === 2 ? 0xc8 : 0xc9); this.writer.uint(bytes.length, width) }
          this.writer.byte(payload.type & 255); this.writer.raw(bytes); return
        }
        if (this.format !== "cbor") throw new BinaryCodecError("unsupportedType")
        if (key === "$undefined") { if (payload !== true) throw new BinaryCodecError("invalidTag"); this.writer.byte(0xf7); return }
        if (key === "$cborSimple") {
          if (typeof payload !== "number" || !Number.isInteger(payload) || payload < 0 || payload > 255 || (payload >= 20 && payload < 32)) throw new BinaryCodecError("invalidTag")
          this.writer.byte(payload < 20 ? 0xe0 + payload : 0xf8); if (payload >= 32) this.writer.byte(payload); return
        }
        if (key === "$cborTag") {
          if (!isRecord(payload) || Object.keys(payload).length !== 2 || typeof payload.tag !== "string" || !/^\d{1,20}$/.test(payload.tag) || !Object.hasOwn(payload, "value")) throw new BinaryCodecError("invalidTag")
          this.cborHead(6, BigInt(payload.tag)); this.value(payload.value, depth + 1); return
        }
        throw new BinaryCodecError("invalidTag")
      }
      this.map(Object.entries(value), depth)
    } finally { this.active.delete(value) }
  }
}

export function parseBinaryJson(input: string): BinaryJson {
  if (input.length > BINARY_CODEC_LIMITS.jsonChars) throw new BinaryCodecError("limit")
  const tokens = /"(?:[^"\\]|\\[\s\S])*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null|[{}\[\]]/g
  let match: RegExpExecArray | null, count = 0, depth = 0
  while ((match = tokens.exec(input))) {
    const token = match[0]
    if (token === "}" || token === "]") { depth--; continue }
    if (token === "{" || token === "[") depth++
    if (++count > BINARY_CODEC_LIMITS.values || depth > BINARY_CODEC_LIMITS.depth * 4) throw new BinaryCodecError("limit")
    if (/^-?\d/.test(token)) { const number = Number(token); if (!Number.isFinite(number) || (Number.isInteger(number) && !Number.isSafeInteger(number))) throw new BinaryCodecError("unsafeNumber") }
  }
  let value: BinaryJson
  try { value = JSON.parse(input) } catch { throw new BinaryCodecError("invalidJson") }
  return value
}
export function encodeBinaryJson(value: BinaryJson, format: BinaryCodecFormat): Uint8Array<ArrayBuffer> {
  if (format !== "msgpack" && format !== "cbor") throw new BinaryCodecError("invalidFormat")
  const encoder = new Encoder(format); encoder.value(value); return encoder.writer.finish()
}
export function decodeBinaryJson(bytes: Uint8Array, format: BinaryCodecFormat): BinaryJson {
  if (format !== "msgpack" && format !== "cbor") throw new BinaryCodecError("invalidFormat")
  if (bytes.length > BINARY_CODEC_LIMITS.bytes) throw new BinaryCodecError("limit")
  const reader = new Reader(bytes), value = format === "msgpack" ? reader.msgpack() : reader.cbor()
  if (reader.pos !== bytes.length) throw new BinaryCodecError("trailingData", reader.pos)
  stringifyBinaryJson(value)
  return value
}
export function stringifyBinaryJson(value: BinaryJson): string {
  const output = JSON.stringify(value, null, 2)
  if (output.length > BINARY_CODEC_LIMITS.jsonChars) throw new BinaryCodecError("limit")
  return output
}
