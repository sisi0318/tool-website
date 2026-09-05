import { afterEach, describe, expect, it, vi } from "vitest"
import { protobufAdapter } from "./protobuf"

afterEach(() => vi.unstubAllGlobals())

describe("Protobuf adapter", () => {
  it("decodes in a browser without Node Buffer", async () => {
    vi.stubGlobal("Buffer", undefined)
    expect((await protobufAdapter.execute({ data: "089601" }, {})).decoded).toEqual({ field_1: 150 })
  })

  it("preserves uint64 precision and repeated values", async () => {
    const result = await protobufAdapter.execute({ data: "08ffffffffffffffffff010801" }, {})
    expect(result.decoded).toEqual({ field_1: ["18446744073709551615", 1] })
  })

  it("reads multi-byte tags, fixed fields and nested messages", async () => {
    const result = await protobufAdapter.execute({ data: "e0122a0d785634121204082a1007" }, {})
    expect(result.decoded).toEqual({ field_300: 42, field_1: 305419896, field_2: { "1": 42, "2": 7 } })
  })

  it("rejects truncated input instead of returning a partial success", async () => {
    await expect(protobufAdapter.execute({ data: "08011080" }, {})).rejects.toThrow()
  })

  it("encodes numeric-tag JSON and exposes the original Hex bytes", async () => {
    expect(await protobufAdapter.execute({ data: '{"1":150}', mode: "encode" }, {})).toEqual({ decoded: { field_1: 150 }, encoded: "089601" })
  })

  it("uses the same exact schema conversion as tool pages", async () => {
    const config = { schema: 'syntax="proto3"; message User { uint64 id=1; }', messageType: "User" }
    const encoded = await protobufAdapter.execute({ data: '{"id":"18446744073709551615"}', mode: "encode" }, config)
    const decoded = await protobufAdapter.execute({ data: encoded.encoded, mode: "decode" }, config)
    expect(decoded.decoded).toEqual({ id: "18446744073709551615" })
  })
})
