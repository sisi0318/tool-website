import { afterEach, describe, expect, it, vi } from "vitest"

import { CLIPBOARD_FAILURE_EVENT, copyImageToClipboard, copyTextToClipboard } from "./clipboard"

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

describe("copyImageToClipboard", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("writes a PNG as a ClipboardItem", async () => {
    const write = vi.fn().mockResolvedValue(undefined)
    const items: Array<Record<string, Promise<Blob>>> = []
    vi.stubGlobal("ClipboardItem", class { constructor(data: Record<string, Promise<Blob>>) { items.push(data) } })
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { write } })
    const png = new Blob(["png"], { type: "image/png" })

    await expect(copyImageToClipboard(png)).resolves.toBe(true)
    expect(write).toHaveBeenCalledTimes(1)
    await expect(items[0]["image/png"]).resolves.toBe(png)
  })

  it("reports an image failure when the browser cannot hold images", async () => {
    vi.stubGlobal("ClipboardItem", undefined)
    const listener = vi.fn()
    window.addEventListener(CLIPBOARD_FAILURE_EVENT, listener)
    try {
      await expect(copyImageToClipboard(new Blob(["png"], { type: "image/png" }))).resolves.toBe(false)
      expect((listener.mock.calls[0][0] as CustomEvent).detail).toBe("image")
    } finally {
      window.removeEventListener(CLIPBOARD_FAILURE_EVENT, listener)
    }
  })
})
