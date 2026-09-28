import { TOOL_CATALOG } from "@/lib/tools/catalog"

export interface SearchResult {
  toolId: string
  toolName: string
  /** 命中的功能名；命中的是工具本身（id、名称、关键词）时为空串 */
  featureName: string
  featureDescription?: string
  /** 打开工具时传给 feature 参数的值；工具本身命中时不传 */
  featureParam?: string
}

type SearchTranslations = Record<string, { name?: string } | undefined>

interface SearchableFeature {
  name: string
  description?: string
  param?: string
}

export interface SearchableTool {
  toolId: string
  toolName: string
  /** 目录顺序，同分时靠前的在前 */
  order: number
  keywords: readonly string[]
  features: readonly SearchableFeature[]
}

/**
 * 工作台搜索索引，从 lib/tools/catalog.ts 派生。
 *
 * 这里曾是一份和目录平行手写的表，漏掉过 currency 与 time——
 * 于是搜「汇率」「时间戳」永远没有结果。
 */
export function createToolSearchIndex(translations: SearchTranslations): SearchableTool[] {
  return TOOL_CATALOG.flatMap((entry, order) => {
    const toolName = translations[entry.translationKey]?.name
    if (!toolName) return []

    return [{
      toolId: entry.id,
      toolName,
      order,
      keywords: entry.keywords ?? [],
      features: entry.features.map(([name, description, param]) => ({ name, description, param })),
    }]
  })
}

/** 忽略大小写、空白与常见分隔符：「SHA-256」和「sha256」视为同一个词 */
function squash(value: string): string {
  return value.toLocaleLowerCase().replace(/[\s\-_/.·]+/g, "")
}

function matchScore(text: string | undefined, query: string, exact: number, prefix: number, contains: number): number {
  const value = text ? squash(text) : ""
  if (!value) return 0
  if (value === query) return exact
  if (value.startsWith(query)) return prefix
  return value.includes(query) ? contains : 0
}

/**
 * 按工具聚合并排序。以前是逐个功能做子串过滤、按目录顺序返回，回车打开第一条：
 * 目录前面的新工具只要描述里带到关键词就排在前面，搜 json 打开的是 OCR、
 * 搜 sha256 打开的是 HMAC。现在工具 id、名称的完全或前缀匹配优先，其次关键词、
 * 功能名，描述命中分最低；每个工具只出一行，附上命中的功能。
 */
export function searchTools(index: readonly SearchableTool[], term: string, limit = 12): SearchResult[] {
  const query = squash(term.trim())
  if (!query) return []

  const matches = index.flatMap((tool) => {
    let best: { score: number; feature?: SearchableFeature } = { score: 0 }
    const consider = (score: number, feature?: SearchableFeature) => {
      if (score > best.score) best = { score, feature }
    }

    consider(Math.max(matchScore(tool.toolId, query, 100, 90, 70), matchScore(tool.toolName, query, 100, 90, 80)))
    for (const keyword of tool.keywords) consider(matchScore(keyword, query, 95, 85, 65))
    for (const feature of tool.features) {
      consider(matchScore(feature.name, query, 88, 75, 60), feature)
      consider(matchScore(feature.description, query, 40, 35, 30), feature)
    }

    return best.score > 0 ? [{ tool, ...best }] : []
  })

  matches.sort((left, right) => right.score - left.score || left.tool.order - right.tool.order)

  return matches.slice(0, limit).map(({ tool, feature }) => ({
    toolId: tool.toolId,
    toolName: tool.toolName,
    featureName: feature?.name ?? "",
    featureDescription: feature?.description,
    featureParam: feature ? (feature.param ?? feature.name) : undefined,
  }))
}
