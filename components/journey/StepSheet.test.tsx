import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { clearRegistry } from "@/lib/canvas/registry"
import { registerHashAdapter } from "@/lib/adapters/hash"
import type { JourneyStep } from "@/lib/journey/types"
import { StepSheet } from "./StepSheet"

vi.mock("@/hooks/use-translations", () => ({
  useTranslations: () => (key: string) => key,
}))

const hashStep = (config: Record<string, unknown>): JourneyStep => ({ tool: "hash", config, outputPort: "hash" })

function renderSheet(step: JourneyStep, onRun = vi.fn()) {
  render(<StepSheet open onOpenChange={() => {}} step={step} running={false} onRun={onRun} />)
  return onRun
}

describe("StepSheet", () => {
  beforeEach(() => {
    clearRegistry()
    registerHashAdapter()
  })

  it("configures a new step without running it", () => {
    const run = renderSheet(hashStep({}))
    expect(run).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "runNewStep" }))
    expect(run).toHaveBeenCalledTimes(1)
  })

  it("建议创建的步骤 config 为空时,联动下拉仍按默认分类给出算法列表", () => {
    renderSheet(hashStep({}))

    expect(screen.getByRole("combobox", { name: "Category" })).toHaveValue("md")
    const algorithm = screen.getByRole("combobox", { name: "Algorithm" })
    expect(algorithm).toHaveValue("md5")
    expect(algorithm.querySelectorAll("option").length).toBeGreaterThan(0)
  })

  it("切换分类时旧算法不在新列表里就落到第一项,并随运行一起提交", () => {
    const onRun = renderSheet(hashStep({ category: "md", algorithm: "md5" }))

    fireEvent.change(screen.getByRole("combobox", { name: "Category" }), { target: { value: "sha2" } })
    expect(screen.getByRole("combobox", { name: "Algorithm" })).toHaveValue("sha2-224")

    fireEvent.click(screen.getByRole("button", { name: "runNewStep" }))
    expect(onRun).toHaveBeenCalledWith(
      expect.objectContaining({ category: "sha2", algorithm: "sha2-224", outputFormat: "hex" }),
      "hash",
    )
  })

  it("shows the running step with a cancel button inside the sheet, because the page behind it cannot be reached", () => {
    const onCancel = vi.fn()
    render(<StepSheet open onOpenChange={() => {}} step={hashStep({})} running progress={{ current: 1, total: 1, tool: "hash" }} onCancel={onCancel} onRun={() => {}} />)
    expect(screen.getByRole("status")).toHaveTextContent("applying")
    expect(screen.getByRole("button", { name: "runNewStep" })).toBeDisabled()
    fireEvent.click(screen.getByRole("button", { name: "cancel" }))
    expect(onCancel).toHaveBeenCalledOnce()
  })
})
