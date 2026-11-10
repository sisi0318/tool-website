"use client"

import { useCallback } from "react"
import { describeStep } from "@/lib/journey/describe"
import type { JourneyNode } from "@/lib/journey/types"
import { useNodeLabel } from "@/hooks/use-node-label"
import { useTranslations } from "@/hooks/use-translations"
import { zhJourney } from "@/lib/translations/zh-namespaces/journey"
import { zhJourneySuggestions } from "@/lib/translations/zh-namespaces/journeySuggestions"

/**
 * 一步在界面上的名字：做了什么，而不是用了哪个工具。
 * 对得上建议矩阵里的动作短语就用短语（“Base64 解码”），否则是工具名加上关键选项（“哈希计算 · SHA-2-256”）。
 */
export function useStepTitle() {
  const t = useTranslations("journey", zhJourney)
  const st = useTranslations("journeySuggestions", zhJourneySuggestions)
  const nodeLabel = useNodeLabel()

  return useCallback(
    (node: Pick<JourneyNode, "parentId" | "via" | "label">): string => {
      if (node.parentId === null || !node.via) return node.parentId === null ? t("trailInput") : node.label
      const description = describeStep(node.via)
      const name = description.labelKey ? st(description.labelKey) : nodeLabel({ type: node.via.tool, label: node.label })
      return [name, ...description.details].join(" · ")
    },
    [nodeLabel, st, t],
  )
}
