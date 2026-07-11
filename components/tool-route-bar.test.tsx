import React from "react"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { ToolRouteBar } from "./tool-route-bar"

vi.mock("next/navigation", () => ({
  usePathname: () => "/tools/data-detector",
}))

vi.mock("@/hooks/use-translations", () => ({
  useTranslations: (namespace: string) => (key: string) => {
    const translations: Record<string, string> = {
      "tools.dataDetector.name": "Smart Data Detector",
      "common.backToTools": "Back to tools",
      "common.focusInputHint": "Focus input",
      "common.copyToolLink": "Copy tool link",
      "common.linkCopied": "Link copied",
      "common.openInWorkspace": "Open in workspace",
    }
    return translations[`${namespace}.${key}`] ?? key
  },
}))

describe("ToolRouteBar", () => {
  it("exposes newly added tools to the mobile route actions", () => {
    render(<ToolRouteBar />)

    expect(screen.getByText("Smart Data Detector")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Back to tools" })).toHaveAttribute("href", "/tools")
    expect(screen.getByRole("link", { name: "Open in workspace" })).toHaveAttribute(
      "href",
      "/tools?tool=data-detector",
    )
    expect(screen.getByRole("button", { name: "Copy tool link" })).toBeInTheDocument()
  })
})
