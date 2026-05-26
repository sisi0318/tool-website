import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Canvas - Tool Website",
  description: "Low-code canvas for building tool pipelines",
}

export default function CanvasLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
