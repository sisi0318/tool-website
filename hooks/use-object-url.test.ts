import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { useObjectUrl, useObjectUrlRegistry } from "./use-object-url"

describe("useObjectUrl", () => {
  const createObjectURL = vi.fn()
  const revokeObjectURL = vi.fn()

  beforeEach(() => {
    createObjectURL.mockReset()
    revokeObjectURL.mockReset()
    createObjectURL
      .mockReturnValueOnce("blob:first")
      .mockReturnValueOnce("blob:second")

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

  it("replaces and releases URLs as the source changes", async () => {
    const first = new Blob(["first"])
    const second = new Blob(["second"])
    const { result, rerender, unmount } = renderHook(
      ({ source }) => useObjectUrl(source),
      { initialProps: { source: first as Blob | null } },
    )

    await waitFor(() => expect(result.current).toBe("blob:first"))

    rerender({ source: second })
    await waitFor(() => expect(result.current).toBe("blob:second"))
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:first")

    unmount()
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:second")
  })

  it("returns null without allocating when no source is provided", () => {
    const { result } = renderHook(() => useObjectUrl(null))

    expect(result.current).toBeNull()
    expect(createObjectURL).not.toHaveBeenCalled()
  })

  it("tracks imperative URLs and releases pending entries on unmount", () => {
    const { result, unmount } = renderHook(() => useObjectUrlRegistry())
    let firstUrl = ""
    let secondUrl = ""

    act(() => {
      firstUrl = result.current.create(new Blob(["first"]))
      secondUrl = result.current.create(new Blob(["second"]))
      result.current.revoke(firstUrl)
    })

    expect(revokeObjectURL).toHaveBeenCalledWith(firstUrl)

    unmount()
    expect(revokeObjectURL).toHaveBeenCalledWith(secondUrl)
    expect(revokeObjectURL).toHaveBeenCalledTimes(2)
  })
})
