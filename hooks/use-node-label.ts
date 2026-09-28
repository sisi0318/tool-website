"use client"

import { useCallback } from "react"
import { useTranslations } from "@/hooks/use-translations"
import { zhNodes } from "@/lib/translations/zh-namespaces/nodes"
import type { NodeDefinition } from "@/lib/canvas/types"

/**
 * 节点的显示名：按 type 取当前语言的名称（lib/translations 的 nodes.*），没有翻译时用定义里的英文 label。
 * 以前画布、旅程的足迹、选择器、步骤面板一律显示英文名，中文界面里夹着 66 个英文名称。
 */
export function useNodeLabel() {
  const t = useTranslations("nodes", zhNodes)
  return useCallback((node: Pick<NodeDefinition, "type" | "label">) => {
    const translated = t(node.type)
    // 取不到翻译时得到的是键本身（nodes.<type>，或只回显 <type>），这时用英文 label
    return translated === `nodes.${node.type}` || translated === node.type ? node.label : translated
  }, [t])
}
