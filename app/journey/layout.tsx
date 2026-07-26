import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "数据旅程",
  description:
    "粘贴任意数据，自动识别 JWT、Base64、JSON、时间戳等格式，一步步探索转换；走过的路径自动成为可分享、可复用的处理流程。",
  alternates: {
    canonical: "/journey",
  },
  openGraph: {
    title: "数据旅程",
    description: "粘贴任意数据，识别、探索、一键串联工具，路径可分享可复用。",
    url: "/journey",
  },
}

export default function JourneyLayout({ children }: { children: React.ReactNode }) {
  return children
}
