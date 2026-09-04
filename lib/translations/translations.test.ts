import { describe, expect, it } from "vitest"

import { en } from "./en"
import { zh } from "./zh"
import { DEFAULT_LOCALE, getLoadedDictionary, loadDictionary, resolveTranslation } from "./index"

/** 把嵌套字典摊平成 "a.b.c" 键集合 */
function flatten(value: unknown, prefix = ""): string[] {
  if (value === null || typeof value !== "object") return [prefix]
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    flatten(child, prefix ? `${prefix}.${key}` : key),
  )
}

describe("中英文案", () => {
  /**
   * 两份文案拆开维护后最容易出现的问题就是漂移 —— 此前就有只存在于英文侧、
   * 无任何调用方的 showAllAlgorithmResults，以及只有中文侧才有的键。
   */
  it("键完全对齐", () => {
    const zhKeys = new Set(flatten(zh))
    const enKeys = new Set(flatten(en))

    expect([...zhKeys].filter((key) => !enKeys.has(key)).sort(), "英文缺少这些键").toEqual([])
    expect([...enKeys].filter((key) => !zhKeys.has(key)).sort(), "中文缺少这些键").toEqual([])
  })

  it("没有空文案", () => {
    for (const [locale, dictionary] of [["zh", zh], ["en", en]] as const) {
      for (const key of flatten(dictionary)) {
        expect(resolveTranslation(dictionary, key).trim(), `${locale}.${key} 为空`).not.toBe("")
      }
    }
  })

  it("中文随首屏就位，英文按需加载", async () => {
    expect(DEFAULT_LOCALE).toBe("zh")
    expect(getLoadedDictionary("zh")).toBe(zh)

    const loaded = await loadDictionary("en")
    expect(loaded).toBe(en)
    // 加载过一次后进缓存，切回来不再重复请求
    expect(getLoadedDictionary("en")).toBe(en)
  })
})

describe("resolveTranslation", () => {
  it("按点号路径取值", () => {
    expect(resolveTranslation(zh, "common.siteName")).toBe("工具站")
  })

  it("取不到时返回键本身，便于在界面上看出缺哪条", () => {
    expect(resolveTranslation(zh, "nope.missing")).toBe("nope.missing")
    // 命中的是对象而不是字符串时同样按缺失处理
    expect(resolveTranslation(zh, "common")).toBe("common")
  })
})
