"use client"

import { use, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"

// This is a catch-all route handler for tool-specific routes
export default function ToolPage({ params }: { params: Promise<{ tool: string }> }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { tool } = use(params)

  useEffect(() => {
    // 检查工具ID是否包含逗号，表示多个工具
    const toolIds = tool.split(",")

    // Create a new URLSearchParams object
    const newParams = new URLSearchParams()

    // Add the tool parameter with all tool IDs
    newParams.append("tool", tool)

    // Copy any existing query parameters
    searchParams.forEach((value, key) => {
      newParams.append(key, value)
    })

    // Redirect to the main tools page with the tool ID in the URL
    router.replace(`/tools?${newParams.toString()}`)
  }, [tool, router, searchParams])

  return (
    <div className="container mx-auto px-4 py-8 text-center">
      <p>Redirecting to tool...</p>
    </div>
  )
}
