import { render, screen } from "@testing-library/react"
import { expect, it, vi } from "vitest"
import { ValueCard } from "./ValueCard"
import type { JourneyNode } from "@/lib/journey/types"
vi.mock("@/hooks/use-translations", () => { const t = (key: string) => key; return { useTranslations: () => t } })
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }))
it("does not allow a prior result to be downloaded while a new input is running", () => {
  const node: JourneyNode = { id: "result", parentId: "input", via: { tool: "string-to-file", config: {}, outputPort: "file" }, value: new File(["old result"], "result.txt", { type: "text/plain" }), valueType: "bytes", label: "File", createdAt: 0 }
  const { rerender } = render(<ValueCard node={node} running onOpenStepSheet={vi.fn()} onRerunFromRoot={vi.fn()} />)
  expect(screen.getByRole("button", { name: "download" })).toBeDisabled()
  rerender(<ValueCard node={{ ...node, value: new File(["new result"], "result.txt", { type: "text/plain" }) }} running={false} onOpenStepSheet={vi.fn()} onRerunFromRoot={vi.fn()} />)
  expect(screen.getByRole("button", { name: "download" })).toBeEnabled()
})
it("offers editing the input on the root only, and step settings everywhere else", () => {
  const root: JourneyNode = { id: "input", parentId: null, via: null, value: "abc", valueType: "string", label: "Input", createdAt: 0 }
  const onEditInput = vi.fn()
  const { rerender } = render(<ValueCard node={root} running={false} onOpenStepSheet={vi.fn()} onRerunFromRoot={vi.fn()} onEditInput={onEditInput} />)
  screen.getByRole("button", { name: "editInput" }).click()
  expect(onEditInput).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole("button", { name: "stepConfigTitle" })).not.toBeInTheDocument()
  rerender(<ValueCard node={{ ...root, id: "step", parentId: "input", via: { tool: "hash", config: {}, outputPort: "hash" } }} running={false} onOpenStepSheet={vi.fn()} onRerunFromRoot={vi.fn()} onEditInput={onEditInput} />)
  expect(screen.queryByRole("button", { name: "editInput" })).not.toBeInTheDocument()
  expect(screen.getByRole("button", { name: "stepConfigTitle" })).toBeInTheDocument()
})
