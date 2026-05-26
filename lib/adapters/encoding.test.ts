import { describe, it, expect, beforeEach } from "vitest"
import { encodingAdapter, registerEncodingAdapter } from "./encoding"
import { getNodeDefinition, clearRegistry } from "../canvas/registry"

beforeEach(() => {
  clearRegistry()
  registerEncodingAdapter()
})

describe("encodingAdapter", () => {
  it("定义正确", () => {
    expect(encodingAdapter.type).toBe("encoding")
    expect(encodingAdapter.category).toBe("crypto")
    expect(encodingAdapter.inputs).toHaveLength(2)
    expect(encodingAdapter.outputs).toHaveLength(1)
  })

  it("Base64 编码", async () => {
    const result = await encodingAdapter.execute(
      { input: "hello", mode: "encode" },
      { encoding: "base64" }
    )
    expect(result.output).toBe("aGVsbG8=")
  })

  it("Base64 解码", async () => {
    const result = await encodingAdapter.execute(
      { input: "aGVsbG8=", mode: "decode" },
      { encoding: "base64" }
    )
    expect(result.output).toBe("hello")
  })

  it("URL 编码", async () => {
    const result = await encodingAdapter.execute(
      { input: "hello world", mode: "encode" },
      { encoding: "url" }
    )
    expect(result.output).toBe("hello%20world")
  })

  it("URL 解码", async () => {
    const result = await encodingAdapter.execute(
      { input: "hello%20world", mode: "decode" },
      { encoding: "url" }
    )
    expect(result.output).toBe("hello world")
  })

  it("HEX 编码", async () => {
    const result = await encodingAdapter.execute(
      { input: "hello", mode: "encode" },
      { encoding: "hex" }
    )
    expect(result.output).toBe("68656c6c6f")
  })

  it("注册后可通过 getNodeDefinition 获取", () => {
    expect(getNodeDefinition("encoding")).toBeDefined()
  })
})
