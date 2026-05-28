"use client"

import dynamic from "next/dynamic"

const CanvasContent = dynamic(() => import("./canvas-content"), { ssr: false })

export default function CanvasPage() {
  return <CanvasContent />
}
