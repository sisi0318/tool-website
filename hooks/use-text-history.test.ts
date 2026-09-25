import type { KeyboardEvent } from "react"
import { act, renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { MAX_TEXT_HISTORY, useTextHistory } from "./use-text-history"

function key(init: { key: string; ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean }) {
  const event = { altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, ...init, preventDefault: vi.fn() }
  return event as unknown as KeyboardEvent<HTMLTextAreaElement> & { preventDefault: ReturnType<typeof vi.fn> }
}

describe("useTextHistory", () => {
  it("undoes and redoes replacements", () => {
    const { result } = renderHook(() => useTextHistory("a"))
    act(() => result.current.replace("b"))
    act(() => result.current.replace("c"))
    expect(result.current.text).toBe("c")

    act(() => result.current.undo())
    act(() => result.current.undo())
    expect(result.current.text).toBe("a")
    expect(result.current.canUndo).toBe(false)

    act(() => result.current.redo())
    expect(result.current.text).toBe("b")
    expect(result.current.canRedo).toBe(true)
  })

  it("keeps text typed after a replacement reachable through redo", () => {
    const { result } = renderHook(() => useTextHistory("a"))
    act(() => result.current.replace("b"))
    act(() => result.current.setText("b typed"))
    act(() => result.current.undo())
    expect(result.current.text).toBe("a")
    act(() => result.current.redo())
    expect(result.current.text).toBe("b typed")
  })

  it("drops the redo branch once the user edits", () => {
    const { result } = renderHook(() => useTextHistory("a"))
    act(() => result.current.replace("b"))
    act(() => result.current.undo())
    act(() => result.current.setText("a2"))
    expect(result.current.canRedo).toBe(false)
  })

  it("ignores replacements that change nothing and caps the history", () => {
    const { result } = renderHook(() => useTextHistory("0"))
    act(() => result.current.replace("0"))
    expect(result.current.canUndo).toBe(false)
    for (let index = 1; index <= MAX_TEXT_HISTORY + 5; index += 1) act(() => result.current.replace(String(index)))
    for (let index = 0; index < MAX_TEXT_HISTORY + 5; index += 1) act(() => result.current.undo())
    expect(result.current.text).toBe("5")
  })

  it("takes over Ctrl/Cmd+Z only while the text is still what a replacement produced", () => {
    const { result } = renderHook(() => useTextHistory("a"))
    const beforeReplace = key({ key: "z", ctrlKey: true })
    act(() => result.current.onKeyDown(beforeReplace))
    expect(beforeReplace.preventDefault).not.toHaveBeenCalled()

    act(() => result.current.replace("b"))
    act(() => result.current.setText("b!"))
    const afterTyping = key({ key: "z", metaKey: true })
    act(() => result.current.onKeyDown(afterTyping))
    expect(afterTyping.preventDefault).not.toHaveBeenCalled()
    expect(result.current.text).toBe("b!")

    // 浏览器把键入撤销完，回到替换结果之后，再按就撤销那次替换
    act(() => result.current.setText("b"))
    const undo = key({ key: "z", metaKey: true })
    act(() => result.current.onKeyDown(undo))
    expect(undo.preventDefault).toHaveBeenCalled()
    expect(result.current.text).toBe("a")

    const redo = key({ key: "Z", ctrlKey: true, shiftKey: true })
    act(() => result.current.onKeyDown(redo))
    expect(result.current.text).toBe("b")
    act(() => result.current.undo())
    act(() => result.current.onKeyDown(key({ key: "y", ctrlKey: true })))
    expect(result.current.text).toBe("b")
  })
})
