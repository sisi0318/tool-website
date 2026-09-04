import { TOOL_CATALOG } from "@/lib/tools/catalog"

export interface SearchResult {
  toolId: string
  toolName: string
  featureName: string
  featureDescription?: string
}

type SearchTranslations = Record<string, { name?: string } | undefined>

/**
 * 工作台搜索索引，从 lib/tools/catalog.ts 派生。
 *
 * 这里曾是一份和目录平行手写的表，漏掉过 currency 与 time——
 * 于是搜「汇率」「时间戳」永远没有结果。
 */
export function createSearchableFeatures(translations: SearchTranslations): SearchResult[] {
  return TOOL_CATALOG.flatMap((entry) => {
    const toolName = translations[entry.translationKey]?.name
    if (!toolName) return []

    return entry.features.map(([featureName, featureDescription]) => ({
      toolId: entry.id,
      toolName,
      featureName,
      featureDescription,
    }))
  })
}

export function searchFeatures(features: SearchResult[], term: string): SearchResult[] {
  const normalizedTerm = term.trim().toLocaleLowerCase()
  if (!normalizedTerm) return []

  return features.filter((feature) =>
    [feature.featureName, feature.toolName, feature.featureDescription]
      .filter((value): value is string => Boolean(value))
      .some((value) => value.toLocaleLowerCase().includes(normalizedTerm)),
  )
}
