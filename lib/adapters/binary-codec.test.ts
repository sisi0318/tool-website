// @vitest-environment node
import { describe, expect, it } from "vitest"
import { binaryCodecAdapter, binaryCodecFileAdapter, registerBinaryCodecAdapters } from "./binary-codec"
import { suggestNext } from "../journey/suggest"

describe("binary codec adapters", () => {
  it("encodes to a native binary file and decodes it without a text conversion", async () => {
    const input = { id: { $bigint: "18446744073709551615" }, bytes: { $binary: "AP8BgA==" } }
    const encoded = await binaryCodecAdapter.execute({ input: JSON.stringify(input) }, { operation: "encode", format: "cbor", encoding: "base64" })
    expect(encoded.file).toBeInstanceOf(File); expect((encoded.file as File).type).toBe("application/cbor")
    const decoded = await binaryCodecFileAdapter.execute({ input: encoded.file }, { format: "cbor" })
    expect(decoded.value).toEqual(input); expect(decoded.byteLength).toBe(encoded.byteLength)
  })
  it("handles textual input and a cancelled file read", async () => {
    expect((await binaryCodecAdapter.execute({ input: "82a16101a162920203" }, {})).value).toEqual({ a: 1, b: [2, 3] })
    const controller = new AbortController(); controller.abort()
    await expect(binaryCodecFileAdapter.execute({ input: new File([new Uint8Array([0])], "data.cbor") }, { format: "cbor" }, { signal: controller.signal })).rejects.toThrow()
  })
  it("suggests the correct file format for typed handoffs", () => {
    registerBinaryCodecAdapters()
    expect(suggestNext(new File([new Uint8Array([0])], "data.cbor", { type: "application/cbor" }), "bytes")[0]).toMatchObject({ tool: "binary-codec-file", config: { format: "cbor" }, outputPort: "value" })
  })
})
