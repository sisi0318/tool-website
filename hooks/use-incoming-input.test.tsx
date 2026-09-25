import React from "react"
import { act, render, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ToolActivityProvider } from "@/components/tool-activity"
import { ToolRuntimeParamsProvider } from "@/components/tool-runtime-params"
import { WorkspaceProvider } from "@/components/workspace-context"
import { toolTransfers, type ToolTransfer } from "@/lib/tool-transfer"
import { useIncomingInput } from "./use-incoming-input"

const toast = vi.hoisted(() => vi.fn())
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }))
vi.mock("@/hooks/use-translations", () => ({ useTranslations: () => (key: string) => key }))

function Receiver({ onTransfer }: { onTransfer: (transfer: ToolTransfer) => void }) {
  useIncomingInput(onTransfer)
  return null
}

beforeEach(() => window.history.replaceState(null, "", "/tools/json"))
afterEach(() => { toolTransfers.clear(); toast.mockClear() })

describe("useIncomingInput", () => {
  it("takes a handle from a tool page URL and clears it from the address bar", async () => {
    const id = toolTransfers.put("hello", "Source")
    window.history.replaceState(null, "", `/tools/json#handoff=${id}`)
    const onTransfer = vi.fn()
    render(<Receiver onTransfer={onTransfer} />)
    await waitFor(() => expect(onTransfer).toHaveBeenCalledWith(expect.objectContaining({ value: "hello", source: "Source" })))
    expect(window.location.hash).toBe("")
  })

  it("takes a handle from the workspace tab parameters, only once the tab is active", async () => {
    const id = toolTransfers.put({ a: 1 }, "Source")
    const onTransfer = vi.fn()
    const tree = (active: boolean) => (
      <WorkspaceProvider value={{ openTool: vi.fn() }}>
        <ToolActivityProvider active={active}>
          <ToolRuntimeParamsProvider params={{ handoff: id }}><Receiver onTransfer={onTransfer} /></ToolRuntimeParamsProvider>
        </ToolActivityProvider>
      </WorkspaceProvider>
    )
    const { rerender, unmount } = render(tree(false))
    await act(async () => { await Promise.resolve() })
    expect(onTransfer).not.toHaveBeenCalled()
    rerender(tree(true))
    await waitFor(() => expect(onTransfer).toHaveBeenCalledTimes(1))

    // 撤销关闭标签等重新挂载时不再重复取，也不报过期
    unmount()
    render(tree(true))
    await act(async () => { await Promise.resolve() })
    expect(onTransfer).toHaveBeenCalledTimes(1)
    expect(toast).not.toHaveBeenCalled()
  })

  it("says so when the data is gone", async () => {
    window.history.replaceState(null, "", "/tools/json#handoff=missing")
    render(<Receiver onTransfer={vi.fn()} />)
    await waitFor(() => expect(toast).toHaveBeenCalledWith({ title: "transferExpired", variant: "destructive" }), { timeout: 3000 })
  })
})
