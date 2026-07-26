import type React from "react"
import { toolPageMetadata } from "@/lib/tool-metadata"

export const metadata = toolPageMetadata("image-to-base64")

export default function ToolLayout({ children }: { children: React.ReactNode }) {
  return children
}
