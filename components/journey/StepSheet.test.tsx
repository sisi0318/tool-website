import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { clearRegistry } from "@/lib/canvas/registry"
import { registerHashAdapter } from "@/lib/adapters/hash"
import type { JourneyNode } from "@/lib/journey/types"
import { StepSheet } from "./StepSheet"

vi.mock("@/hooks/use-translations", () => ({
  useTranslations: () => (key: string) => key,
}))

function hashNode(config: Record<string, unknown>): JourneyNode {
  return {
    id: "n1",
    parentId: "root",
    via: { tool: "hash", config, outputPort: "hash" },
    value: "abc",
    valueType: "string",
    label: "Hash",
    createdAt: 0,
  }
}

function renderSheet(node: JourneyNode, onRerun = vi.fn()) {
  render(
    <StepSheet open onOpenChange={() => {}} node={node} running={false} onRerun={onRerun} onDelete={() => {}} />,
  )
  return onRerun
}

describe("StepSheet", () => {
  beforeEach(() => {
    clearRegistry()
    registerHashAdapter()
  })

  it("建议创建的步骤 config 为空时,联动下拉仍按默认分类给出算法列表", () => {
    renderSheet(hashNode({}))

    expect(screen.getByRole("combobox", { name: "Category" })).toHaveValue("md")
    const algorithm = screen.getByRole("combobox", { name: "Algorithm" })
    expect(algorithm).toHaveValue("md5")
    expect(algorithm.querySelectorAll("option").length).toBeGreaterThan(0)
  })

  it("切换分类时旧算法不在新列表里就落到第一项,并随重跑一起提交", () => {
    const onRerun = renderSheet(hashNode({ category: "md", algorithm: "md5" }))

    fireEvent.change(screen.getByRole("combobox", { name: "Category" }), { target: { value: "sha2" } })
    expect(screen.getByRole("combobox", { name: "Algorithm" })).toHaveValue("sha2-224")

    fireEvent.click(screen.getByRole("button", { name: "rerunPath" }))
    expect(onRerun).toHaveBeenCalledWith(
      expect.objectContaining({ category: "sha2", algorithm: "sha2-224", outputFormat: "hex" }),
      "hash",
    )
  })
})
