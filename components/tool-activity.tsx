"use client"

import { createContext, useContext, type ReactNode } from "react"

const ToolActivityContext = createContext(true)

export function ToolActivityProvider({
  active,
  children,
}: {
  active: boolean
  children: ReactNode
}) {
  return (
    <ToolActivityContext.Provider value={active}>
      {children}
    </ToolActivityContext.Provider>
  )
}

export function useToolActivity(): boolean {
  return useContext(ToolActivityContext)
}

/**
 * 页内有多个常驻挂载的面板（Tabs forceMount）时，给每个面板套一层：
 * 工具本身在前台、且面板被选中才算活动，页面级的粘贴等只交给这个面板。
 */
export function PanelActivityProvider({
  active,
  children,
}: {
  active: boolean
  children: ReactNode
}) {
  const toolActive = useToolActivity()
  return (
    <ToolActivityContext.Provider value={toolActive && active}>
      {children}
    </ToolActivityContext.Provider>
  )
}
