import { beforeAll, describe, expect, it } from "vitest"

import { registerAllAdapters } from "../adapters"
import { getNodeDefinition } from "../canvas/registry"
import { isTypeCompatible } from "../canvas/validation"
import type { DataType } from "../canvas/types"
import { detectData, type DetectedDataType } from "../data-detector"
import { applyStep, getMainInputPort } from "./engine"
import { CURATED_MATRIX, suggestNext } from "./suggest"

/**
 * journey.test.ts 只注册 5 个适配器,精选矩阵里其余条目会被 validateEntry
 * 静默丢弃,于是"建议了但一定跑不通"的条目长期无人发现。这里在完整注册表下
 * 逐条校验,并用每种识别类型的代表样本真正执行一遍。
 */
beforeAll(() => {
  registerAllAdapters()
})

/** 依赖真实浏览器画布/网络,单测环境里跳过执行,只做静态校验。 */
const NEEDS_BROWSER = new Set(["qrcode", "qrcode-decode", "exif-viewer", "image-compress", "image-convert", "meme-splitter"])

describe("精选建议矩阵", () => {
  it("每条条目引用的工具都已注册、可链接且非手动执行", () => {
    const entries = [
      ...Object.values(CURATED_MATRIX.byDetection).flat(),
      ...CURATED_MATRIX.imageBytes,
      ...CURATED_MATRIX.genericBytes,
    ]
    expect(entries.length).toBeGreaterThan(0)

    for (const entry of entries) {
      const definition = getNodeDefinition(entry.tool)
      expect(definition, `未注册的工具:${entry.tool}`).toBeDefined()
      expect(definition!.executionMode, `${entry.tool} 是手动执行,不能作为自动建议`).not.toBe("manual")
      expect(getMainInputPort(definition!), `${entry.tool} 没有主输入端口`).not.toBeNull()
    }
  })

  it("识别驱动的条目都能接收 string(不会被静默丢弃)", () => {
    for (const [detectionType, entries] of Object.entries(CURATED_MATRIX.byDetection)) {
      for (const entry of entries ?? []) {
        const port = getMainInputPort(getNodeDefinition(entry.tool)!)!
        expect(
          isTypeCompatible("string" as DataType, port.dataType),
          `${detectionType} → ${entry.tool} 主输入是 ${port.dataType},string 送不进去,该建议永远不会出现`,
        ).toBe(true)
      }
    }
  })

  it("bytes 条目都能接收 bytes(不会被静默丢弃)", () => {
    for (const entry of [...CURATED_MATRIX.imageBytes, ...CURATED_MATRIX.genericBytes]) {
      const port = getMainInputPort(getNodeDefinition(entry.tool)!)!
      expect(
        isTypeCompatible("bytes" as DataType, port.dataType),
        `${entry.tool} 主输入是 ${port.dataType},bytes 送不进去`,
      ).toBe(true)
    }
  })

  /** 每种识别类型一个代表样本,只跑该类型自己的精选条目。 */
  const SAMPLES: Partial<Record<DetectedDataType, string>> = {
    base64: "SGVsbG8sIHdvcmxk",
    jwt:
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." +
      "eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ." +
      "SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
    json: '{"b":{"x":1},"a":2}',
    "url-encoded": "hello%20world%21",
    hex: "48656c6c6f",
    xml: "<root><item>1</item></root>",
    timestamp: "1716239022",
    csv: "a,b\n1,2",
    "plain-text": "hello journey",
  }

  const cases = Object.entries(SAMPLES).flatMap(([type, sample]) =>
    (CURATED_MATRIX.byDetection[type as DetectedDataType] ?? [])
      .filter((entry) => !NEEDS_BROWSER.has(entry.tool))
      .map((entry) => ({ type, sample, entry })),
  )

  it.each(cases)("$type → $entry.label 能真正算出结果", async ({ sample, entry }) => {
    const definition = getNodeDefinition(entry.tool)!
    const result = await applyStep(sample, {
      tool: entry.tool,
      config: entry.config ?? {},
      outputPort: entry.outputPort ?? definition.outputs[0]?.id ?? "",
    })
    expect(result.value).toBeDefined()
    expect(result.value).not.toBeNull()
  })

  it("时间戳建议真的转换传入的值,而不是返回此刻", async () => {
    expect(detectData("1716239022").matches.some((match) => match.type === "timestamp")).toBe(true)

    const suggestion = suggestNext("1716239022", "string").find((entry) => entry.tool === "time")
    expect(suggestion).toBeDefined()

    const result = await applyStep("1716239022", {
      tool: "time",
      config: suggestion!.config,
      outputPort: "iso",
    })
    expect(result.value).toBe(new Date(1716239022 * 1000).toISOString())
  })

  it("gzip/zip 建议携带解压所需的输入编码与格式", () => {
    for (const type of ["gzip", "zip"] as const) {
      const entry = CURATED_MATRIX.byDetection[type]?.[0]
      expect(entry, `${type} 缺少精选条目`).toBeDefined()
      // 识别器只在 base64 文本上判定这两种格式,不声明 inputEncoding 必然解析失败。
      expect(entry!.config).toMatchObject({ operation: "decompress", inputEncoding: "base64" })
      expect(entry!.config).toHaveProperty("format", type)
    }
  })

  it("hex → 进制转换声明了源进制", () => {
    const entry = CURATED_MATRIX.byDetection.hex?.find((candidate) => candidate.tool === "base-converter")
    expect(entry?.config).toMatchObject({ fromBase: "16" })
  })
})
