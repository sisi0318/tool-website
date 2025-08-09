import type React from "react"
import Header from "@/components/header"

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
      {children}
    </div>
  )
}
