import type { Metadata } from "next"
import "@xyflow/react/dist/style.css"

export const metadata: Metadata = {
  title: "工具画布",
  description: "低代码画布：把多个工具节点连成可复用的工作流",
}

export default function CanvasLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
