import React, { useEffect } from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ToolActivityProvider } from "@/components/tool-activity"
import OcrPage from "./page"

const received = vi.hoisted(() => ({ image: [] as string[], batch: [] as string[] }))
vi.mock("@/hooks/use-translations", () => { const translate = (key: string) => key; return { useTranslations: () => translate } })
vi.mock("@/components/tools/image-ocr-panel", async () => {
  const { usePasteFiles } = await import("@/hooks/use-paste-files")
  return { default: function ImagePanel() { usePasteFiles((files) => received.image.push(files[0].name)); return null } }
})
vi.mock("@/components/tools/image-batch-panel", async () => {
  const { usePasteFiles } = await import("@/hooks/use-paste-files")
  return { default: function BatchPanel() { usePasteFiles((files) => received.batch.push(files[0].name)); return null } }
})
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

  describe("pasting files", () => {
    beforeEach(() => { received.image = []; received.batch = [] })

    function paste(name: string) {
      const event = new Event("paste", { bubbles: true, cancelable: true })
      Object.defineProperty(event, "clipboardData", { value: { files: [new File(["x"], name, { type: "image/png" })], types: ["Files"], items: [] } })
      document.body.dispatchEvent(event)
    }

    it("hands the file only to the panel that is showing", () => {
      render(<OcrPage />)
      paste("first.png")
      expect(received).toEqual({ image: ["first.png"], batch: [] })

      fireEvent.mouseDown(screen.getByRole("tab", { name: /batchMode/ }))
      paste("second.png")
      expect(received).toEqual({ image: ["first.png"], batch: ["second.png"] })
    })

    it("ignores pastes while the tool sits in a background workspace tab", () => {
      render(<ToolActivityProvider active={false}><OcrPage /></ToolActivityProvider>)
      paste("ignored.png")
      expect(received).toEqual({ image: [], batch: [] })
    })
  })
})
