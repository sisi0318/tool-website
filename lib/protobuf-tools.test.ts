import { describe, expect, it } from "vitest"
import { bytesToBase64, hexToBytes } from "./binary"
import { bytesToHex, decodeProtobuf, decodeProtobufWithSchema, encodeProtobuf, encodeProtobufWithSchema, inspectProtobuf, loadProtobuf, parseProtobufInput, ProtobufError } from "./protobuf-tools"

describe("Protobuf wire decoding", () => {
  it.each([
    ["089601", { "1": 150 }],
    ["08ffffffffffffffffff01", { "1": "18446744073709551615" }],
    ["088080808010", { "1": 4294967296 }],
    ["09ffffffffffffffff", { "1": "18446744073709551615" }],
    ["0d78563412", { "1": 305419896 }],
    ["e0122a", { "300": 42 }],
    ["080110030802", { "1": [1, 2], "2": 3 }],
    ["0a03416461", { "1": "Ada" }],
    ["1204082a1007", { "2": { "1": 42, "2": 7 } }],
    ["0a02ff00", { "1": "/wA=" }],
    ["0b10070c", { "1": { "2": 7 } }],
    ["", {}],
  ])("decodes %s without losing field data", (hex, expected) => {
    expect(decodeProtobuf(hexToBytes(hex))).toEqual(expected)
  })

  it.each(["00", "0f", "0896", "08011080", "0a0501", "0d0102", "090102", "08ffffffffffffffffff02", "0b0801", "0b080114", "0c"])("rejects malformed message %s", (hex) => {
    expect(() => decodeProtobuf(hexToBytes(hex))).toThrow(ProtobufError)
  })

  it("reports the failing byte offset", () => {
    try {
      decodeProtobuf(hexToBytes("08011080"))
      expect.fail("Expected truncated input")
    } catch (error) {
      expect(error).toMatchObject({ code: "truncated", offset: 4 })
    }
  })

  it("records absolute payload ranges for nested fields", () => {
    const result = inspectProtobuf(hexToBytes("087b120b0a034164611204082a1007"))
    expect(result.fields[1]).toMatchObject({ fieldNumber: 2, offset: 2, dataOffset: 4, end: 15, payloadEnd: 15, kind: "message" })
    expect(result.fields[1].children?.[1].children?.[0]).toMatchObject({ offset: 11, dataOffset: 12, end: 13, value: 42 })
  })

  it("does not infer a nested message from a valid prefix with invalid trailing bytes", () => {
    expect(decodeProtobuf(hexToBytes("0a03080100"))).toEqual({ "1": "CAEA" })
  })

  it("bounds field counts", () => {
    expect(() => decodeProtobuf(hexToBytes("0801".repeat(20_001)))).toThrow(/limit/)
  })

  it("accepts hex, base64 and whitespace with explicit format overrides", () => {
    const bytes = hexToBytes("089601")
    expect(parseProtobufInput("08 96\n01")).toEqual(bytes)
    expect(parseProtobufInput(bytesToBase64(bytes))).toEqual(bytes)
    expect(parseProtobufInput("CAFE", "base64")).not.toEqual(parseProtobufInput("CAFE", "hex"))
    expect(() => parseProtobufInput("abc", "hex")).toThrow(/invalidInput/)
  })
})

describe("Protobuf encoding", () => {
  it("encodes nested objects, booleans and repeated fields", async () => {
    expect(bytesToHex(await encodeProtobuf('{"1":150,"2":{"1":"Ada"},"3":[true,false]}'))).toBe("08960112050a0341646118011800")
  })

  it("accepts legacy canvas field names", async () => {
    expect(bytesToHex(await encodeProtobuf('{"field_1":150}'))).toBe("089601")
  })

  it.each(['{"name":1}', '{"0":1}', '{"1oops":1}', '[]', 'null', '{"1":9007199254740993}'])("rejects unsafe or ambiguous object %s", async (json) => {
    await expect(encodeProtobuf(json)).rejects.toThrow(ProtobufError)
  })

  it("preserves uint64/int64 decimal strings through schema encode/decode", async () => {
    const pb = await loadProtobuf()
    const type = pb.parse('syntax="proto3"; message T { uint64 id = 1; int64 signed = 2; bytes body = 3; }').root.lookupType("T")
    const input = { id: "18446744073709551615", signed: "-9223372036854775808", body: "AP8=" }
    expect(decodeProtobufWithSchema(encodeProtobufWithSchema(JSON.stringify(input), type), type)).toEqual(input)
    for (const id of ["18446744073709551616", "-1", "abc", 9007199254740992]) {
      expect(() => encodeProtobufWithSchema(JSON.stringify({ id }), type)).toThrow(/unsafeInteger/)
    }
  })

  it("validates 64-bit values in nested messages, arrays and maps", async () => {
    const pb = await loadProtobuf()
    const type = pb.parse('syntax="proto3"; message T { message Child { uint64 id=1; } repeated Child children=1; map<string,uint64> counts=2; }').root.lookupType("T")
    const input = { children: [{ id: "18446744073709551615" }], counts: { exact: "9007199254740993" } }
    expect(decodeProtobufWithSchema(encodeProtobufWithSchema(JSON.stringify(input), type), type)).toEqual(input)
    expect(() => encodeProtobufWithSchema('{"children":[{"id":"bad"}]}', type)).toThrow()
  })
})
