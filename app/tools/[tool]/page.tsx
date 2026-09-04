import { notFound, redirect } from "next/navigation"

import { isKnownToolId } from "@/lib/tools/catalog"

/**
 * 每个工具都有自己的 app/tools/<id>/page.tsx,静态路由优先级更高,
 * 所以能走到这个 catch-all 的只有两种情况:
 *   1. 逗号分隔的多工具链接(`/tools/hash,json`)—— 转到工作台;
 *   2. 不存在的工具 id —— 必须 404。
 *
 * 之前这里无条件转发到 `/tools?tool=<未知 id>`,工作台会静默过滤掉它,
 * 用户看到的是一个空工作台而不是 404,搜索引擎拿到的则是 200 的软 404。
 */
export default async function ToolAliasPage({
  params,
  searchParams,
}: {
  params: Promise<{ tool: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { tool } = await params
  const toolIds = decodeURIComponent(tool)
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)

  if (toolIds.length === 0 || !toolIds.every(isKnownToolId)) {
    notFound()
  }

  const query = new URLSearchParams()
  query.set("tool", toolIds.join(","))

  // 透传其余查询参数,但不要重复写入 tool
  for (const [key, value] of Object.entries(await searchParams)) {
    if (key === "tool" || value === undefined) continue
    for (const entry of Array.isArray(value) ? value : [value]) {
      query.append(key, entry)
    }
  }

  redirect(`/tools?${query.toString()}`)
}
