import type React from "react"
import { toolPageMetadata } from "@/lib/tool-metadata"

export const metadata = toolPageMetadata("http-tester")

export default function ToolLayout({ children }: { children: React.ReactNode }) {
  return children
}
