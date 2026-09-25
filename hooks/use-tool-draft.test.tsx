import React, { useEffect } from "react"
import { act, render, renderHook, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import { MAX_TOOL_DRAFT_CHARS, TOOL_DRAFT_PREFIX, useToolDraft } from "./use-tool-draft"

beforeEach(() => window.sessionStorage.clear())

describe("useToolDraft", () => {
  it("restores the tab's draft after a reload", () => {
    const first = renderHook(() => useToolDraft("xml"))
    act(() => first.result.current[1]("<note/>"))
    first.unmount()

    const second = renderHook(() => useToolDraft("xml"))
    expect(second.result.current[0]).toBe("<note/>")
  })

  it("lets an explicit input from the link win over the draft", () => {
    window.sessionStorage.setItem(`${TOOL_DRAFT_PREFIX}xml`, "<old/>")
    // UtilityWorkbench applies ?input= in a child effect, which runs before the page's effects
    function LinkInput({ onInput }: { onInput: (value: string) => void }) {
      useEffect(() => onInput("<from-link/>"), [onInput])
      return null
    }
    function Page() {
      const [input, setInput] = useToolDraft("xml")
      return <><LinkInput onInput={setInput} /><output>{input}</output></>
    }
    render(<Page />)
    expect(screen.getByRole("status")).toHaveTextContent("<from-link/>")
  })

  it("forgets empty and oversized drafts", () => {
    const { result } = renderHook(() => useToolDraft("xml"))
    act(() => result.current[1]("keep"))
    expect(window.sessionStorage.getItem(`${TOOL_DRAFT_PREFIX}xml`)).toBe("keep")
    act(() => result.current[1](""))
    expect(window.sessionStorage.getItem(`${TOOL_DRAFT_PREFIX}xml`)).toBeNull()
    act(() => result.current[1]("x".repeat(MAX_TOOL_DRAFT_CHARS + 1)))
    expect(window.sessionStorage.getItem(`${TOOL_DRAFT_PREFIX}xml`)).toBeNull()
  })
})
