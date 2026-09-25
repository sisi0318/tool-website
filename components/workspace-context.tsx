"use client"

import { createContext, useContext, type ReactNode } from "react"

export interface WorkspaceControls {
  /** 在工作台里打开（或切到）某个工具的标签；params 进入该标签的运行时参数 */
  openTool: (toolId: string, params?: Record<string, string>) => void
}

const WorkspaceContext = createContext<WorkspaceControls | null>(null)

/** 工作台（/tools）提供；独立工具页上为 null。发送数据时据此决定就地开标签还是跳转页面 */
export function WorkspaceProvider({ value, children }: { value: WorkspaceControls; children: ReactNode }) {
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

export function useWorkspace(): WorkspaceControls | null {
  return useContext(WorkspaceContext)
}
