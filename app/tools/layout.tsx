import type React from "react"
import Header from "@/components/header"
import { ToolRouteBar } from "@/components/tool-route-bar"

export default function ToolsLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: any
}) {
  return (
    <div>
      <Header />
      <ToolRouteBar />
      <div className="tools-surface">{children}</div>
    </div>
  )
}
