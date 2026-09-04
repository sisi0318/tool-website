import { describe, expect, it } from "vitest"

import { SEARCH_FEATURE_GROUPS } from "@/app/tools/search-utils"
import { toolTranslationKeys } from "@/components/tool-route-bar"
import { TOOL_IDS, TOOL_SEO } from "@/lib/tool-metadata"
import { translations } from "@/lib/translations"

/**
 * 同一批工具目前分散在多份手写清单里(SEO、搜索索引、路由栏、翻译)。
 * 在收敛成单一注册表之前,先用一致性断言挡住漂移 —— 搜索索引此前就漏了
 * currency 与 time,导致搜"汇率""时间戳"永远没有结果。
 */
const seoIds = new Set(TOOL_IDS)
const searchIds = new Set(Object.values(SEARCH_FEATURE_GROUPS).map(([toolId]) => toolId))
const routeBarIds = new Set(Object.keys(toolTranslationKeys))

function diff(left: Set<string>, right: Set<string>): string[] {
  return [...left].filter((id) => !right.has(id)).sort()
}

describe("工具注册表一致性", () => {
  it("SEO 元数据覆盖 47 个工具", () => {
    expect(seoIds.size).toBe(47)
  })

  it("搜索索引与 SEO 清单覆盖同一批工具", () => {
    expect(diff(seoIds, searchIds), "这些工具在工作台搜索里找不到").toEqual([])
    expect(diff(searchIds, seoIds), "搜索索引里存在已下线的工具").toEqual([])
  })

  it("路由栏与 SEO 清单覆盖同一批工具", () => {
    expect(diff(seoIds, routeBarIds), "这些工具页缺少返回/分享路由栏").toEqual([])
    expect(diff(routeBarIds, seoIds), "路由栏里存在已下线的工具").toEqual([])
  })

  it("每个工具的翻译键在中英文里都存在", () => {
    for (const [, translationKey] of Object.entries(toolTranslationKeys)) {
      const [namespace, field] = translationKey.split(".")
      for (const locale of ["zh", "en"] as const) {
        const bucket = (translations[locale].tools as unknown as Record<string, Record<string, string>>)[namespace]
        expect(bucket, `${locale} 缺少 tools.${namespace}`).toBeDefined()
        expect(bucket[field], `${locale} 缺少 tools.${translationKey}`).toBeTruthy()
      }
    }
  })

  it("每个工具都有非空的 SEO 标题与描述", () => {
    for (const id of TOOL_IDS) {
      expect(TOOL_SEO[id].title, `${id} 缺少 SEO 标题`).toBeTruthy()
      expect(TOOL_SEO[id].description.length, `${id} 的 SEO 描述过短`).toBeGreaterThan(10)
    }
  })
})
