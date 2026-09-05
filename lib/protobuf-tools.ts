import type * as Protobuf from "protobufjs"
import { base64ToBytes, bytesToBase64, bytesToHex, hexToBytes } from "./binary"

export const PROTOBUF_MAX_BYTES = 10 * 1024 * 1024
const MAX_DEPTH = 32
const MAX_FIELDS = 20_000
const MAX_WORK = 64 * 1024 * 1024
const MAX_FIELD_NUMBER = 536870911
const ZERO = BigInt(0)
const SEVEN = BigInt(7)
const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER)

export type ProtobufErrorCode = "invalidInput" | "truncated" | "invalidTag" | "invalidWireType" | "invalidVarint" | "invalidGroup" | "limit" | "invalidObject" | "invalidField" | "unsafeInteger"

export class ProtobufError extends Error {
  constructor(public readonly code: ProtobufErrorCode, public readonly offset = 0) {
    super(`Protobuf ${code} at byte ${offset}`)
    this.name = "ProtobufError"
  }
}

export type ProtobufValue = string | number | ProtobufObject | ProtobufValue[]
export interface ProtobufObject { [field: string]: ProtobufValue }
export type ProtobufFieldKind = "varint" | "fixed64" | "text" | "message" | "bytes" | "group" | "fixed32"
export interface ProtobufField {
  fieldNumber: number
  wireType: 0 | 1 | 2 | 3 | 5
  offset: number
  dataOffset: number
  payloadEnd: number
  end: number
  kind: ProtobufFieldKind
  value: ProtobufValue
  children?: ProtobufField[]
  text?: string
}

export interface ProtobufInspection {
  bytes: Uint8Array
  fields: ProtobufField[]
  value: ProtobufObject
}

let protobufPromise: Promise<typeof Protobuf> | undefined
export function loadProtobuf(): Promise<typeof Protobuf> {
  protobufPromise ??= import("protobufjs").catch((error) => {
    protobufPromise = undefined
    throw error
  })
  return protobufPromise
}

export function detectProtobufInput(input: string): "hex" | "base64" | "unknown" {
  const clean = input.replace(/\s/g, "")
  if (/^(?:[\da-f]{2})+$/i.test(clean)) return "hex"
  if (clean && /^[A-Za-z0-9+/]+={0,2}$/.test(clean) && clean.length % 4 !== 1) return "base64"
  return "unknown"
}

export function parseProtobufInput(input: string, encoding: "auto" | "hex" | "base64" = "auto"): Uint8Array {
  if (input.length > PROTOBUF_MAX_BYTES * 3) throw new ProtobufError("limit")
  const format = encoding === "auto" ? detectProtobufInput(input) : encoding
  let bytes: Uint8Array
  try {
    if (format === "hex") bytes = hexToBytes(input)
    else if (format === "base64") bytes = base64ToBytes(input)
    else throw new Error("Unknown format")
  } catch {
    throw new ProtobufError("invalidInput")
  }
  if (bytes.byteLength > PROTOBUF_MAX_BYTES) throw new ProtobufError("limit")
  return bytes
}

export function protobufInteger(value: bigint): number | string {
  return value <= MAX_SAFE && value >= -MAX_SAFE ? Number(value) : value.toString()
}

interface Cursor { pos: number; end: number }
function readVarint(bytes: Uint8Array, cursor: Cursor): bigint {
  let value = ZERO
  for (let index = 0; index < 10; index += 1) {
    if (cursor.pos >= cursor.end) throw new ProtobufError("truncated", cursor.pos)
    const byte = bytes[cursor.pos++]
    if (index === 9 && byte > 1) throw new ProtobufError("invalidVarint", cursor.pos - 1)
    value |= BigInt(byte & 127) << (BigInt(index) * SEVEN)
    if (byte < 128) return value
  }
  throw new ProtobufError("invalidVarint", cursor.pos - 1)
}

export function protobufFieldsToObject(fields: readonly ProtobufField[]): ProtobufObject {
  const grouped = new Map<string, ProtobufValue[]>()
  for (const field of fields) {
    const key = String(field.fieldNumber)
    const values = grouped.get(key) ?? []
    values.push(field.value)
    grouped.set(key, values)
  }
  return Object.fromEntries([...grouped].map(([key, values]) => [key, values.length === 1 ? values[0] : values]))
}

/** Wire metadata uses absolute, half-open byte ranges. Only fully valid nested messages are inferred. */
export function inspectProtobuf(bytes: Uint8Array): ProtobufInspection {
  if (bytes.byteLength > PROTOBUF_MAX_BYTES) throw new ProtobufError("limit")
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let fieldCount = 0
  let work = 0

  const parseMessage = (start: number, end: number, depth: number, group?: number): { fields: ProtobufField[]; end: number; payloadEnd: number } => {
    if (depth > MAX_DEPTH || (work += end - start) > MAX_WORK) throw new ProtobufError("limit", start)
    const cursor = { pos: start, end }
    const fields: ProtobufField[] = []
    while (cursor.pos < end) {
      const offset = cursor.pos
      const tag = readVarint(bytes, cursor)
      if (tag > BigInt(0xffffffff)) throw new ProtobufError("invalidTag", offset)
      const fieldNumber = Number(tag >> BigInt(3))
      const wireType = Number(tag & SEVEN)
      if (fieldNumber < 1 || fieldNumber > MAX_FIELD_NUMBER) throw new ProtobufError("invalidTag", offset)
      if (wireType === 4) {
        if (group !== fieldNumber) throw new ProtobufError("invalidGroup", offset)
        return { fields, end: cursor.pos, payloadEnd: offset }
      }
      if (wireType > 5) throw new ProtobufError("invalidWireType", offset)
      if (++fieldCount > MAX_FIELDS) throw new ProtobufError("limit", offset)

      let dataOffset = cursor.pos
      let payloadEnd: number
      let kind: ProtobufFieldKind
      let value: ProtobufValue
      let children: ProtobufField[] | undefined
      let text: string | undefined
      if (wireType === 0) {
        kind = "varint"
        value = protobufInteger(readVarint(bytes, cursor))
      } else if (wireType === 1 || wireType === 5) {
        const length = wireType === 1 ? 8 : 4
        if (end - cursor.pos < length) throw new ProtobufError("truncated", cursor.pos)
        kind = wireType === 1 ? "fixed64" : "fixed32"
        value = wireType === 1 ? protobufInteger(view.getBigUint64(cursor.pos, true)) : view.getUint32(cursor.pos, true)
        cursor.pos += length
      } else if (wireType === 3) {
        const nested = parseMessage(cursor.pos, end, depth + 1, fieldNumber)
        children = nested.fields
        cursor.pos = nested.end
        fields.push({ fieldNumber, wireType, offset, dataOffset, payloadEnd: nested.payloadEnd, end: cursor.pos, kind: "group", children, value: protobufFieldsToObject(children) })
        continue
      } else {
        const length = readVarint(bytes, cursor)
        dataOffset = cursor.pos
        if (length > BigInt(end - cursor.pos)) throw new ProtobufError("truncated", cursor.pos)
        cursor.pos += Number(length)
        const payload = bytes.subarray(dataOffset, cursor.pos)
        try { text = new TextDecoder("utf-8", { fatal: true }).decode(payload) } catch { /* Binary payload. */ }
        if (payload.length > 0) {
          try {
            children = parseMessage(dataOffset, cursor.pos, depth + 1).fields
          } catch (error) {
            if (error instanceof ProtobufError && error.code === "limit") throw error
            // A LEN payload can be arbitrary bytes; invalid candidate messages stay bytes/text.
          }
        }
        if (text !== undefined && !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(text)) {
          kind = "text"
          value = text
        } else if (children?.length) {
          kind = "message"
          value = protobufFieldsToObject(children)
        } else {
          kind = "bytes"
          value = bytesToBase64(payload)
        }
      }
      payloadEnd = cursor.pos
      fields.push({ fieldNumber, wireType: wireType as ProtobufField["wireType"], offset, dataOffset, payloadEnd, end: cursor.pos, kind, value, ...(children ? { children } : {}), ...(text !== undefined ? { text } : {}) })
    }
    if (group !== undefined) throw new ProtobufError("invalidGroup", cursor.pos)
    return { fields, end: cursor.pos, payloadEnd: cursor.pos }
  }

  const fields = parseMessage(0, bytes.length, 0).fields
  return { bytes, fields, value: protobufFieldsToObject(fields) }
}

export function decodeProtobuf(bytes: Uint8Array): ProtobufObject {
  return inspectProtobuf(bytes).value
}

function assertSafeJson(value: unknown, depth = 0): void {
  if (depth > MAX_DEPTH) throw new ProtobufError("limit")
  if (typeof value === "number" && (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value)))) {
    throw new ProtobufError("unsafeInteger")
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) assertSafeJson(item, depth + 1)
  }
}

export async function encodeProtobuf(input: string): Promise<Uint8Array> {
  if (input.length > PROTOBUF_MAX_BYTES) throw new ProtobufError("limit")
  const object: unknown = JSON.parse(input)
  assertSafeJson(object)
  const pb = await loadProtobuf()
  let fieldCount = 0

  const encodeObject = (value: unknown, depth: number): Uint8Array => {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new ProtobufError("invalidObject")
    if (depth > MAX_DEPTH) throw new ProtobufError("limit")
    const writer = pb.Writer.create()
    for (const [key, raw] of Object.entries(value)) {
      const match = /^(?:field_)?([1-9]\d*)$/.exec(key)
      const tag = match ? Number(match[1]) : 0
      if (!Number.isInteger(tag) || tag < 1 || tag > MAX_FIELD_NUMBER) throw new ProtobufError("invalidField")
      for (const item of Array.isArray(raw) ? raw : [raw]) {
        if (item === null || item === undefined) continue
        if (++fieldCount > MAX_FIELDS) throw new ProtobufError("limit")
        if (typeof item === "number") {
          if (Number.isInteger(item)) writer.uint32(tag * 8).int64(item)
          else writer.uint32(tag * 8 + 1).double(item)
        } else if (typeof item === "boolean") writer.uint32(tag * 8).bool(item)
        else if (typeof item === "string") writer.uint32(tag * 8 + 2).string(item)
        else writer.uint32(tag * 8 + 2).bytes(encodeObject(item, depth + 1))
      }
    }
    const bytes = writer.finish()
    if (bytes.length > PROTOBUF_MAX_BYTES) throw new ProtobufError("limit")
    return bytes
  }
  return encodeObject(object, 0)
}

export function decodeProtobufWithSchema(bytes: Uint8Array, type: Protobuf.Type): ProtobufObject {
  if (bytes.length > PROTOBUF_MAX_BYTES) throw new ProtobufError("limit")
  // Protobuf JSON represents all 64-bit integers as decimal strings, preserving exact values.
  return type.toObject(type.decode(bytes), { longs: String, enums: String, bytes: String, defaults: true }) as ProtobufObject
}

export function encodeProtobufWithSchema(input: string, type: Protobuf.Type): Uint8Array {
  if (input.length > PROTOBUF_MAX_BYTES) throw new ProtobufError("limit")
  const value: unknown = JSON.parse(input)
  assertSafeJson(value)
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ProtobufError("invalidObject")
  const checkLongs = (messageType: Protobuf.Type, object: Record<string, unknown>) => {
    for (const field of messageType.fieldsArray) {
      field.resolve()
      const raw = object[field.name]
      if (raw === undefined || raw === null) continue
      const items = field.map ? Object.values(raw as object) : field.repeated && Array.isArray(raw) ? raw : [raw]
      for (const item of items) {
        if (/^(?:u?int|sint|s?fixed)64$/.test(field.type)) {
          if ((typeof item !== "number" && typeof item !== "string") || !/^-?\d+$/.test(String(item))) throw new ProtobufError("unsafeInteger")
          const integer = BigInt(item)
          const unsigned = field.type === "uint64" || field.type === "fixed64"
          const limit = BigInt(1) << BigInt(unsigned ? 64 : 63)
          if (integer < (unsigned ? ZERO : -limit) || integer >= limit) throw new ProtobufError("unsafeInteger")
        } else if (field.resolvedType && "fieldsArray" in field.resolvedType && item && typeof item === "object") {
          checkLongs(field.resolvedType as Protobuf.Type, item as Record<string, unknown>)
        }
      }
    }
  }
  checkLongs(type, value as Record<string, unknown>)
  const message = type.fromObject(value)
  const error = type.verify(message)
  if (error) throw new Error(error)
  const bytes = type.encode(message).finish()
  if (bytes.length > PROTOBUF_MAX_BYTES) throw new ProtobufError("limit")
  return bytes
}

export { bytesToHex }
