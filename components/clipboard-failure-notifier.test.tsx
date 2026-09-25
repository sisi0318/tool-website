import React from "react"
import { act, render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ClipboardFailureNotifier } from "./clipboard-failure-notifier"
import { CLIPBOARD_FAILURE_EVENT } from "@/lib/clipboard"

const toast = vi.fn()
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }))
vi.mock("@/hooks/use-translations", () => { const translate = (key: string) => key; return { useTranslations: () => translate } })

describe("ClipboardFailureNotifier", () => {
  it("shows one toast per reported copy failure", () => {
    const view = render(<ClipboardFailureNotifier />)
    act(() => { window.dispatchEvent(new Event(CLIPBOARD_FAILURE_EVENT)) })
    expect(toast).toHaveBeenCalledWith({ title: "copyFailed", description: "copyFailedHint", variant: "destructive" })
    view.unmount()
    window.dispatchEvent(new Event(CLIPBOARD_FAILURE_EVENT))
    expect(toast).toHaveBeenCalledTimes(1)
  })
})
