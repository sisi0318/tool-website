import { fireEvent, render, screen } from "@testing-library/react"
import { expect, it, vi } from "vitest"
import { TemplateStage } from "./TemplateStage"
import { getJourneyTemplate } from "@/lib/journey/templates"
vi.mock("@/hooks/use-translations", () => { const t = (key: string) => key; return { useTranslations: () => t } })
vi.mock("@/lib/object-url", () => ({ createObjectUrl: () => "blob:preview", revokeObjectUrl: vi.fn() }))
it("prefills a sample for review and only runs after an explicit click", () => {
  const onStart = vi.fn(), template = getJourneyTemplate("csv-json")!
  render(<TemplateStage template={template} starting={false} progress={null} hasDraft onStart={onStart} onCancel={vi.fn()} onExit={vi.fn()} onOpenTemplates={vi.fn()} />)
  expect(screen.getByLabelText("inputText")).toHaveValue(template.sampleText); expect(onStart).not.toHaveBeenCalled()
  fireEvent.change(screen.getByLabelText("inputText"), { target: { value: "id\n00123" } }); fireEvent.click(screen.getByRole("button", { name: "run" })); expect(onStart).toHaveBeenCalledWith("id\n00123")
})
it("shows cancellable progress and disables input replacement during a run", () => {
  const onCancel = vi.fn()
  render(<TemplateStage template={getJourneyTemplate("scan-text")!} starting progress={{ current: 1, total: 3, tool: "ocr" }} hasDraft={false} onStart={vi.fn()} onCancel={onCancel} onExit={vi.fn()} onOpenTemplates={vi.fn()} />)
  expect(screen.getByRole("button", { name: "chooseImage" })).toBeDisabled(); fireEvent.click(screen.getByRole("button", { name: "cancel" })); expect(onCancel).toHaveBeenCalledOnce()
})
