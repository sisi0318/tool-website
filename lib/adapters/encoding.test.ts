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
    expect(encodingAdapter.config).toHaveLength(3)
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

describe("encoding adapter — 以前静默失败的编码", () => {
  const run = async (encoding: string, mode: string, input: string) => {
    const def = getNodeDefinition("encoding")!
    const result = await def.execute({ input, encoding, mode }, {})
    return String(result.output)
  }

  it("实现了下拉里列出的每一种编码(不再原样返回)", async () => {
    // 这 7 种此前落到 switch 的 default 分支,encode 与 decode 都返回原文。
    for (const [encoding, sample] of [
      ["unicode", "中"],
      ["utf8", "A"],
      ["ascii", "A"],
      ["base32", "hi"],
      ["binary", "A"],
      ["morse", "SOS"],
      ["rot13", "abc"],
    ] as const) {
      const encoded = await run(encoding, "encode", sample)
      expect(encoded, `${encoding} 应产生与输入不同的编码结果`).not.toBe(sample)
      expect(await run(encoding, "decode", encoded)).toBe(sample)
    }
  })

  it("punycode 走 RFC 3492 实现", async () => {
    expect(await run("punycode", "encode", "中文.com")).toBe("xn--fiq228c.com")
    expect(await run("punycode", "decode", "xn--fiq228c.com")).toBe("中文.com")
  })

  it("兼容旧配置里的 quoted-printable 取值,并拒绝未知编码", async () => {
    expect(await run("quoted-printable", "encode", "café")).toContain("=C3=A9")
    await expect(run("rot47", "encode", "x")).rejects.toThrow(/Unsupported encoding/)
  })
})
