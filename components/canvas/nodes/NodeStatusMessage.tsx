"use client"

import { useTranslations } from "@/hooks/use-translations"
import { CYCLE_ERROR, UPSTREAM_ERROR, UPSTREAM_PENDING } from "@/lib/canvas/store"
import { NODE_INTERACTIVE_CLASS } from "./interactive"

/** 节点状态码转成可读文案;其余错误是适配器抛出的原文 */
export function nodeStatusText(error: string, t: (key: string) => string): string {
  if (error === CYCLE_ERROR) return t("nodeInCycle")
  if (error === UPSTREAM_ERROR) return t("nodeUpstreamFailed")
  if (error === UPSTREAM_PENDING) return t("nodeWaitingForUpstream")
  return error
}

/** 节点底部的错误或"等待上游"提示,BaseNode 与 ToolNode 共用 */
export function NodeStatusMessage({ error }: { error: string }) {
  const t = useTranslations("canvas")
  const pending = error === UPSTREAM_PENDING

  return (
    <div
      className={`rounded-b-[calc(var(--md-sys-shape-corner-medium)-2px)] border-t px-3 py-2 ${
        pending ? "border-md-outline-variant bg-md-surface-container-high" : "border-md-error/40 bg-md-error-container/60"
      }`}
    >
      <p className={`${NODE_INTERACTIVE_CLASS} max-h-24 overflow-auto whitespace-pre-wrap break-words text-xs ${pending ? "text-md-on-surface-variant" : "text-md-on-error-container"}`}>
        {nodeStatusText(error, t)}
      </p>
    </div>
  )
}
