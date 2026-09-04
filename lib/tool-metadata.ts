import type { Metadata } from "next"

import { TOOL_CATALOG, TOOL_IDS, getToolEntry } from "@/lib/tools/catalog"

export { TOOL_IDS }

interface ToolSeoEntry {
  title: string
  description: string
}

/**
 * 每个工具页的 SEO 标题与描述，从 lib/tools/catalog.ts 派生。
 * 标题会经根布局的 title.template 追加 “| 工具站”。
 */
export const TOOL_SEO: Record<string, ToolSeoEntry> = Object.fromEntries(
  TOOL_CATALOG.map((entry) => [entry.id, entry.seo]),
)

export function toolPageMetadata(toolId: string): Metadata {
  const entry = getToolEntry(toolId)
  if (!entry) return {}

  return {
    title: entry.seo.title,
    description: entry.seo.description,
    alternates: {
      canonical: `/tools/${toolId}`,
    },
    openGraph: {
      title: entry.seo.title,
      description: entry.seo.description,
      url: `/tools/${toolId}`,
    },
  }
}
