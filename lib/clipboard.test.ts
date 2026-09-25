import { afterEach, describe, expect, it, vi } from "vitest"

import { CLIPBOARD_FAILURE_EVENT, copyTextToClipboard } from "./clipboard"

describe("copyTextToClipboard", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("uses the Clipboard API when available", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    })

    await expect(copyTextToClipboard("hello")).resolves.toBe(true)
    expect(writeText).toHaveBeenCalledWith("hello")
  })

  it("falls back when Clipboard API rejects", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    })
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: vi.fn().mockReturnValue(true),
    })

    await expect(copyTextToClipboard("fallback")).resolves.toBe(true)
  })

  it("announces a failure unless the caller reports it itself", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    })
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: vi.fn().mockReturnValue(false),
    })
    const listener = vi.fn()
    window.addEventListener(CLIPBOARD_FAILURE_EVENT, listener)
    try {
      await expect(copyTextToClipboard("nope")).resolves.toBe(false)
      expect(listener).toHaveBeenCalledTimes(1)
      await expect(copyTextToClipboard("nope", { reportFailure: false })).resolves.toBe(false)
      expect(listener).toHaveBeenCalledTimes(1)
    } finally {
      window.removeEventListener(CLIPBOARD_FAILURE_EVENT, listener)
    }
  })
})
