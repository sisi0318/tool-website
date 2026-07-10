"use client"

import { createContext, useContext, type ReactNode } from "react"

export type ToolRuntimeParams = Record<string, string>

const ToolRuntimeParamsContext = createContext<ToolRuntimeParams | undefined>(undefined)

export function ToolRuntimeParamsProvider({
  params,
  children,
}: {
  params?: ToolRuntimeParams
  children: ReactNode
}) {
  return <ToolRuntimeParamsContext.Provider value={params}>{children}</ToolRuntimeParamsContext.Provider>
}

export function useToolRuntimeParams() {
  return useContext(ToolRuntimeParamsContext)
}
