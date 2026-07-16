import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  downloadBlob,
  revokeObjectUrls,
  withObjectUrl,
} from "./object-url"

describe("object URL helpers", () => {
  const createObjectURL = vi.fn()
  const revokeObjectURL = vi.fn()

  beforeEach(() => {
    createObjectURL.mockReset()
    revokeObjectURL.mockReset()
    createObjectURL.mockReturnValue("blob:mock-url")

    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: createObjectURL,
    })
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: revokeObjectURL,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    document.body.innerHTML = ""
  })

  it("releases a temporary URL after an async operation", async () => {
    const blob = new Blob(["image"])

    const result = await withObjectUrl(blob, async (url) => {
      expect(url).toBe("blob:mock-url")
      expect(revokeObjectURL).not.toHaveBeenCalled()
      return "done"
    })

    expect(result).toBe("done")
    expect(createObjectURL).toHaveBeenCalledWith(blob)
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-url")
  })

  it("releases a temporary URL when the operation fails", async () => {
    await expect(
      withObjectUrl(new Blob(["image"]), () => {
        throw new Error("failed")
      }),
    ).rejects.toThrow("failed")

    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-url")
  })

  it("delays revocation until after a download click", () => {
    vi.useFakeTimers()
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined)

    downloadBlob(new Blob(["report"]), "report.txt")

    expect(click).toHaveBeenCalledOnce()
    expect(document.querySelector("a")).toBeNull()
    expect(revokeObjectURL).not.toHaveBeenCalled()

    vi.runAllTimers()
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-url")
  })

  it("releases every URL in a collection", () => {
    revokeObjectUrls(["blob:first", null, "blob:second", undefined])

    expect(revokeObjectURL).toHaveBeenNthCalledWith(1, "blob:first")
    expect(revokeObjectURL).toHaveBeenNthCalledWith(2, "blob:second")
  })
})
