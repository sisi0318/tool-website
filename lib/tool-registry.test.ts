import { describe, expect, it } from "vitest"

import { createSearchableFeatures } from "@/app/tools/search-utils"
import { TOOL_COMPONENTS } from "@/app/tools/tool-components"
import { toolTranslationKeys } from "@/components/tool-route-bar"
import { TOOL_SEO, toolPageMetadata } from "@/lib/tool-metadata"
import { TOOL_CATALOG, TOOL_IDS, getToolEntry, isKnownToolId } from "@/lib/tools/catalog"
import { en } from "@/lib/translations/en"
import { zh } from "@/lib/translations/zh"

/**
 * lib/tools/catalog.ts 是工具清单的单一事实来源，SEO、搜索索引、路由栏都由它派生。
 * 唯一无法派生的是图标与页面组件（动态 import 的路径必须是字面量，打包器要静态分析），
 * 所以这里守住那张表与目录的一致性。
 */
describe("工具目录", () => {
  it("覆盖 56 个工具且 id 无重复", () => {
    expect(TOOL_CATALOG).toHaveLength(56)
    expect(new Set(TOOL_IDS).size).toBe(TOOL_IDS.length)
  })

  it("id 只用小写、数字与连字符（要作为路由片段）", () => {
    for (const id of TOOL_IDS) {
      expect(id, id).toMatch(/^[a-z0-9-]+$/)
    }
  })

  it("组件表与目录覆盖同一批工具", () => {
    const componentIds = new Set(Object.keys(TOOL_COMPONENTS))
    const catalogIds = new Set(TOOL_IDS)
    expect(
      [...catalogIds].filter((id) => !componentIds.has(id)),
      "这些工具在目录里，但没有图标/页面组件",
    ).toEqual([])
    expect(
      [...componentIds].filter((id) => !catalogIds.has(id)),
      "这些组件已不在目录里",
    ).toEqual([])
  })

  it("每个工具的翻译键在中英文里都存在", () => {
    for (const entry of TOOL_CATALOG) {
      for (const [locale, dictionary] of [["zh", zh], ["en", en]] as const) {
        const bucket = (dictionary.tools as unknown as Record<string, Record<string, string>>)[
          entry.translationKey
        ]
        expect(bucket, `${locale} 缺少 tools.${entry.translationKey}`).toBeDefined()
        expect(bucket.name, `${locale} 缺少 tools.${entry.translationKey}.name`).toBeTruthy()
      }
    }
  })

  it("每个工具都有非空 SEO 标题与描述", () => {
    for (const entry of TOOL_CATALOG) {
      expect(entry.seo.title, `${entry.id} 缺少 SEO 标题`).toBeTruthy()
      expect(entry.seo.description.length, `${entry.id} 的 SEO 描述过短`).toBeGreaterThan(10)
    }
  })

  it("每个工具都有可搜索的功能点", () => {
    for (const entry of TOOL_CATALOG) {
      expect(entry.features.length, `${entry.id} 在工作台里搜不到`).toBeGreaterThan(0)
    }
  })
})

describe("从目录派生的各处清单", () => {
  it("SEO 元数据", () => {
    expect(Object.keys(TOOL_SEO).sort()).toEqual([...TOOL_IDS].sort())
    expect(toolPageMetadata("hash").title).toBe(getToolEntry("hash")!.seo.title)
    expect(toolPageMetadata("not-a-tool")).toEqual({})
  })

  it("路由栏翻译键", () => {
    expect(Object.keys(toolTranslationKeys).sort()).toEqual([...TOOL_IDS].sort())
    expect(toolTranslationKeys["image-to-base64"]).toBe("imageToBase64.name")
  })

  it("搜索索引覆盖每个工具", () => {
    const names = Object.fromEntries(
      TOOL_CATALOG.map((entry) => [entry.translationKey, { name: entry.id }]),
    )
    const results = createSearchableFeatures(names)
    const covered = new Set(results.map((result) => result.toolId))
    expect([...TOOL_IDS].filter((id) => !covered.has(id)), "这些工具搜不到").toEqual([])
  })

  it("isKnownToolId 只认目录里的工具", () => {
    expect(isKnownToolId("hash")).toBe(true)
    expect(isKnownToolId("doc-viewer")).toBe(false)
  })
})
