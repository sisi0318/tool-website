import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { SendToMenu } from "./send-to-menu"
import { WorkspaceProvider } from "@/components/workspace-context"
import { receiveTransfer, toolTransfers, toolTransferIdFromHash, ToolTransferStore } from "@/lib/tool-transfer"

const push = vi.hoisted(() => vi.fn())
const toast = vi.hoisted(() => vi.fn())
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }))
// 两个动态加载的选择器都换成一个按钮：点了就选中 json
vi.mock("next/dynamic", () => ({ default: () => function StubPicker({ onPick }: { onPick: (id: string) => void }) { return <button type="button" onClick={() => onPick("json")}>pick json</button> } }))
vi.mock("@/hooks/use-translations", () => ({ useTranslations: () => (key: string) => key }))
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }))
afterEach(() => { toolTransfers.clear(); push.mockClear(); toast.mockClear(); vi.restoreAllMocks() })

function openMenu(source: string) {
  fireEvent.pointerDown(screen.getByRole("button", { name: `continue · ${source}` }), { button: 0, ctrlKey: false })
}

describe("send-to menu", () => {
  it("navigates using only a handle and preserves the original JSON value", () => {
    render(<SendToMenu value={{ secret: "keep local" }} source="JSON subtree" />)
    openMenu("JSON subtree")
    fireEvent.click(screen.getByRole("menuitem", { name: "journey" }))
    const url = push.mock.calls[0][0] as string
    expect(url).toMatch(/^\/journey#handoff=transfer-/)
    expect(url).not.toContain("secret")
    expect(toolTransfers.take(toolTransferIdFromHash(url.split("#")[1])!)?.value).toEqual({ secret: "keep local" })
  })

  it("opens a tool page with the data from a standalone page", () => {
    render(<SendToMenu value="SELECT 1" source="SQL" />)
    openMenu("SQL")
    fireEvent.click(screen.getByRole("menuitem", { name: "openInTool" }))
    fireEvent.click(screen.getByRole("button", { name: "pick json" }))
    const url = push.mock.calls[0][0] as string
    expect(url).toMatch(/^\/tools\/json#handoff=transfer-/)
    expect(toolTransfers.take(toolTransferIdFromHash(url.split("#")[1])!)?.value).toBe("SELECT 1")
  })

  it("opens the tool in a new workspace tab instead of leaving the workspace", () => {
    const openTool = vi.fn()
    render(<WorkspaceProvider value={{ openTool }}><SendToMenu value="SELECT 1" source="SQL" /></WorkspaceProvider>)
    openMenu("SQL")
    fireEvent.click(screen.getByRole("menuitem", { name: "openInTool" }))
    fireEvent.click(screen.getByRole("button", { name: "pick json" }))
    expect(push).not.toHaveBeenCalled()
    expect(openTool).toHaveBeenCalledWith("json", { handoff: expect.stringMatching(/^transfer-/) })
    expect(toolTransfers.take(openTool.mock.calls[0][1].handoff)?.value).toBe("SELECT 1")
  })

  it("opens the journey in another browser tab from the workspace and hands the data over", async () => {
    const opened = { opener: {} as unknown }
    const open = vi.spyOn(window, "open").mockReturnValue(opened as Window)
    render(<WorkspaceProvider value={{ openTool: vi.fn() }}><SendToMenu value="payload" source="Tool" /></WorkspaceProvider>)
    openMenu("Tool")
    fireEvent.click(screen.getByRole("menuitem", { name: "journey" }))
    expect(push).not.toHaveBeenCalled()
    expect(opened.opener).toBeNull()
    expect(toast).toHaveBeenCalledWith({ title: "journeyOpenedInNewTab" })

    const url = open.mock.calls[0][0] as string
    // 新标签自己的内存里没有这份数据，要向工作台这边要
    expect((await receiveTransfer(toolTransferIdFromHash(url.split("#")[1])!, new ToolTransferStore()))?.value).toBe("payload")
  })

  it("falls back to navigating when the new tab is blocked", () => {
    vi.spyOn(window, "open").mockReturnValue(null)
    render(<WorkspaceProvider value={{ openTool: vi.fn() }}><SendToMenu value="payload" source="Tool" /></WorkspaceProvider>)
    openMenu("Tool")
    fireEvent.click(screen.getByRole("menuitem", { name: "journey" }))
    expect(push).toHaveBeenCalledWith(expect.stringMatching(/^\/journey#handoff=/))
  })
})
