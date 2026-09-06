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
