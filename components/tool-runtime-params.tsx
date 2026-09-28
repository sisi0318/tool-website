"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { useWorkspace } from "@/components/workspace-context"

export type ToolRuntimeParams = Record<string, string>

const ToolRuntimeParamsContext = createContext<ToolRuntimeParams | undefined>(undefined)

/** UtilityWorkbench 自己读写地址栏里的 op / input，这里不重复处理 */
const WORKBENCH_URL_KEYS = new Set(["op", "input"])

export function ToolRuntimeParamsProvider({
  params,
  children,
}: {
  params?: ToolRuntimeParams
  children: ReactNode
}) {
  return <ToolRuntimeParamsContext.Provider value={params}>{children}</ToolRuntimeParamsContext.Provider>
}

/**
 * 独立工具页地址栏里的参数：`/tools/json?feature=format` 或工作台分享链接同款的 `?json_feature=format`。
 * 以前 feature、domain 这类参数只在工作台里生效，独立页上被忽略。
 */
export function readToolUrlParams(search: string, toolId: string): ToolRuntimeParams | undefined {
  const params: ToolRuntimeParams = {}
  const prefix = `${toolId}_`
  for (const [key, value] of new URLSearchParams(search)) {
    const name = key.startsWith(prefix) ? key.slice(prefix.length) : key
    if (!name || WORKBENCH_URL_KEYS.has(name)) continue
    params[name] = value
  }
  return Object.keys(params).length ? params : undefined
}

/**
 * 工具的运行时参数：工作台里来自标签，独立页上来自地址栏（挂载后读取，避免服务端渲染不一致）。
 */
export function useToolRuntimeParams() {
  const params = useContext(ToolRuntimeParamsContext)
  const workspace = useWorkspace()
  const [urlParams, setUrlParams] = useState<ToolRuntimeParams>()

  useEffect(() => {
    if (workspace) return
    setUrlParams(readToolUrlParams(window.location.search, window.location.pathname.split("/")[2] ?? ""))
  }, [workspace])

  return params ?? urlParams
}
