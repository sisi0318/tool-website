import { describe, expect, it } from "vitest"
import { base64ToBytes, bytesToHex, hexToBytes } from "./binary"
import { decodeBinaryJson, encodeBinaryJson, parseBinaryJson, type BinaryCodecFormat, type BinaryJson } from "./binary-codecs"

const decode = (hex: string, format: BinaryCodecFormat = "cbor") => decodeBinaryJson(hexToBytes(hex), format)
describe("CBOR RFC 8949 vectors", () => {
  it.each<Array<[string, BinaryJson]>[number]>([
    ["00", 0], ["17", 23], ["1818", 24], ["1903e8", 1000], ["3863", -100], ["3903e7", -1000], ["f4", false], ["f5", true], ["f6", null],
    ["6449455446", "IETF"], ["62c3bc", "ü"], ["63e6b0b4", "水"], ["64f0908591", "𐅑"], ["4401020304", { $binary: "AQIDBA==" }],
    ["a26161016162820203", { a: 1, b: [2, 3] }], ["1bffffffffffffffff", { $bigint: "18446744073709551615" }], ["3bffffffffffffffff", { $bigint: "-18446744073709551616" }],
    ["c249010000000000000000", { $bigint: "18446744073709551616" }], ["c349010000000000000000", { $bigint: "-18446744073709551617" }],
  ])("decodes and encodes %s independently", (hex, value) => { expect(decode(hex)).toEqual(value); expect(bytesToHex(encodeBinaryJson(value, "cbor"))).toBe(hex) })
  it.each<Array<[string, BinaryJson]>[number]>([
    ["9f018202039f0405ffff", [1, [2, 3], [4, 5]]], ["5f42010243030405ff", { $binary: "AQIDBAU=" }], ["7f657374726561646d696e67ff", "streaming"], ["bf61610161629f0203ffff", { a: 1, b: [2, 3] }], ["5fff", { $binary: "" }], ["7fff", ""],
  ])("decodes indefinite containers %s", (hex, value) => { expect(decode(hex)).toEqual(value); expect(decodeBinaryJson(encodeBinaryJson(value, "cbor"), "cbor")).toEqual(value) })
  it.each<Array<[string, BinaryJson]>[number]>([
    ["f90000", { $number: "0" }], ["f98000", { $number: "-0" }], ["f93c00", { $number: "1" }], ["f93e00", 1.5], ["f97bff", { $number: "65504" }], ["f97c00", { $number: "Infinity" }], ["f9fc00", { $number: "-Infinity" }], ["f97e00", { $number: "NaN" }], ["fb3ff199999999999a", 1.1], ["f7", { $undefined: true }], ["e0", { $cborSimple: 0 }], ["f820", { $cborSimple: 32 }],
  ])("preserves float and simple-value semantics %s", (hex, value) => { expect(decode(hex)).toEqual(value); expect(decodeBinaryJson(encodeBinaryJson(value, "cbor"), "cbor")).toEqual(value) })
  it("retains generic tags without converting dates or tagged byte strings", () => {
    const value = { $cborTag: { tag: "0", value: "2013-03-21T20:04:00Z" } }
    expect(decode("c074323031332d30332d32315432303a30343a30305a")).toEqual(value)
    expect(decodeBinaryJson(encodeBinaryJson(value, "cbor"), "cbor")).toEqual(value)
    expect(decode("d81843010203")).toEqual({ $cborTag: { tag: "24", value: { $binary: "AQID" } } })
  })
})

describe("MessagePack specification vectors", () => {
  it.each<Array<[string, BinaryJson]>[number]>([
    ["c0", null], ["c2", false], ["c3", true], ["7f", 127], ["ff", -1], ["e0", -32], ["d0df", -33], ["cc80", 128], ["cd0100", 256], ["ce00010000", 65536], ["d1ff7f", -129], ["d2ffff7fff", -32769],
    ["a3616263", "abc"], ["c403010203", { $binary: "AQID" }], ["82a16101a162920203", { a: 1, b: [2, 3] }], ["cfffffffffffffffff", { $bigint: "18446744073709551615" }], ["d38000000000000000", { $bigint: "-9223372036854775808" }],
    ["d47faa", { $msgpackExt: { type: 127, data: "qg==" } }], ["c703fe010203", { $msgpackExt: { type: -2, data: "AQID" } }], ["d6ff00000001", { $msgpackExt: { type: -1, data: "AAAAAQ==" } }],
  ])("decodes and encodes %s independently", (hex, value) => { expect(decode(hex, "msgpack")).toEqual(value); expect(bytesToHex(encodeBinaryJson(value, "msgpack"))).toBe(hex) })
  it("exposes original invalid string bytes separately from binary values", () => {
    expect(decode("a1ff", "msgpack")).toEqual({ $msgpackString: "/w==" })
    expect(bytesToHex(encodeBinaryJson({ $msgpackString: "/w==" }, "msgpack"))).toBe("a1ff")
    expect(() => encodeBinaryJson({ $msgpackString: "/w==" }, "cbor")).toThrow("unsupportedType")
  })
})

describe.each<BinaryCodecFormat>(["msgpack", "cbor"])("%s shared semantics and limits", (format) => {
  it("preserves map key types, duplicate keys and reserved-key object collisions", () => {
    const map: BinaryJson = { $map: [[0, "number"], ["0", "string"], ["x", 1], ["x", 2], [{ $number: "0" }, "float"]] }
    expect(decodeBinaryJson(encodeBinaryJson(map, format), format)).toEqual(map)
    const literal: BinaryJson = { $object: { $binary: "literal string" } }
    expect(decodeBinaryJson(encodeBinaryJson(literal, format), format)).toEqual(literal)
    const proto = parseBinaryJson('{"__proto__":{"polluted":true}}')
    const decoded = decodeBinaryJson(encodeBinaryJson(proto, format), format)
    expect(Object.hasOwn(decoded as Record<string, BinaryJson>, "__proto__")).toBe(true); expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })
  it("preserves BOM characters and byte view offsets", () => {
    const bytes = encodeBinaryJson("\uFEFF中", format), wrapped = new Uint8Array(bytes.length + 4); wrapped.set(bytes, 2)
    expect(decodeBinaryJson(wrapped.subarray(2, bytes.length + 2), format)).toBe("\uFEFF中")
  })
  it("covers string, binary and collection length header boundaries", () => {
    for (const length of [0, 15, 16, 31, 32, 255, 256, 65535, 65536]) {
      const text = "a".repeat(length)
      expect(decodeBinaryJson(encodeBinaryJson(text, format), format)).toBe(text)
      const bytes = { $binary: btoa(text) }
      expect(decodeBinaryJson(encodeBinaryJson(bytes, format), format)).toEqual(bytes)
    }
    for (const length of [0, 15, 16, 256]) {
      const value = Array.from({ length }, (_, index) => index)
      expect(decodeBinaryJson(encodeBinaryJson(value, format), format)).toEqual(value)
    }
  })
  it("keeps special numbers and refuses unsafe ordinary JSON numbers", () => {
    for (const text of ["NaN", "Infinity", "-Infinity", "-0", "1", "9007199254740992"]) expect(decodeBinaryJson(encodeBinaryJson({ $number: text }, format), format)).toEqual({ $number: text })
    expect(() => parseBinaryJson('{"n":9007199254740993}')).toThrow("unsafeNumber")
    expect(parseBinaryJson('{"n":{"$bigint":"9007199254740993"}}')).toEqual({ n: { $bigint: "9007199254740993" } })
    expect(() => encodeBinaryJson("\uD800", format)).toThrow("invalidUtf8")
    expect(() => encodeBinaryJson(new Date() as unknown as BinaryJson, format)).toThrow("invalidJson")
  })
  it("rejects truncation, trailing data, excessive depth and invalid tags", () => {
    const bytes = encodeBinaryJson({ a: [1, "abc"] }, format)
    for (let length = 0; length < bytes.length; length++) expect(() => decodeBinaryJson(bytes.subarray(0, length), format)).toThrow()
    const trailing = new Uint8Array(bytes.length + 1); trailing.set(bytes)
    expect(() => decodeBinaryJson(trailing, format)).toThrow("trailingData")
    expect(() => decode((format === "cbor" ? "81" : "91").repeat(66) + "00", format)).toThrow("limit")
    expect(() => parseBinaryJson("[".repeat(300) + "0" + "]".repeat(300))).toThrow("limit")
    expect(() => encodeBinaryJson({ $map: [1] }, format)).toThrow("invalidTag")
    expect(() => encodeBinaryJson({ $binary: "!" }, format)).toThrow("invalidTag")
  })
})

describe("CBOR malformed inputs and format-specific types", () => {
  it.each(["f814", "f81f", "fc", "fd", "fe", "ff", "7f7fffff", "5f6161ff", "bf6161ff", "81ff", "61ff", "c0ff", "1c"])("rejects %s", (hex) => expect(() => decode(hex)).toThrow())
  it("checks declared counts before allocation and does not reinterpret unsupported tags", () => {
    expect(() => decode("9affffffff")).toThrow("limit")
    expect(() => decode("ddffffffff", "msgpack")).toThrow("limit")
    expect(() => decode("c1", "msgpack")).toThrow("invalidData")
    expect(() => encodeBinaryJson({ $cborSimple: 20 }, "cbor")).toThrow("invalidTag")
    expect(() => encodeBinaryJson({ $undefined: true }, "msgpack")).toThrow("unsupportedType")
    expect(() => encodeBinaryJson({ $bigint: "18446744073709551616" }, "msgpack")).toThrow("integerRange")
    expect(base64ToBytes((decode("4401020304") as { $binary: string }).$binary)).toEqual(new Uint8Array([1, 2, 3, 4]))
  })
})
