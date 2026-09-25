import React, { useEffect } from "react"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import OcrPage from "./page"

vi.mock("@/hooks/use-translations", () => { const translate = (key: string) => key; return { useTranslations: () => translate } })
vi.mock("@/components/tools/image-ocr-panel", () => ({ default: () => null }))
vi.mock("@/components/tools/image-batch-panel", () => ({ default: () => null }))
vi.mock("@/components/tools/pdf-ocr-panel", () => ({
  default: function BusyPdfPanel({ onBusyChange }: { onBusyChange?: (busy: boolean) => void }) {
    useEffect(() => { onBusyChange?.(true) }, [onBusyChange])
    return null
  },
}))

describe("OCR page", () => {
  it("marks a sub-tab whose panel is still working in the background", () => {
    render(<OcrPage />)
    expect(screen.getByRole("tab", { name: /pdfMode/ })).toHaveTextContent("runningInBackground")
    expect(screen.getByRole("tab", { name: /imageMode/ })).not.toHaveTextContent("runningInBackground")
  })
})
