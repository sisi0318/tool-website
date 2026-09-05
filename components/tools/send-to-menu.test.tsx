import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { SendToMenu } from "./send-to-menu"
import { toolTransfers, toolTransferIdFromHash } from "@/lib/tool-transfer"

const push = vi.hoisted(() => vi.fn())
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }))
vi.mock("next/dynamic", () => ({ default: () => () => null }))
vi.mock("@/hooks/use-translations", () => ({ useTranslations: () => (key: string) => key }))
afterEach(() => { toolTransfers.clear(); push.mockClear() })

describe("send-to menu", () => {
  it("navigates using only a handle and preserves the original JSON value", () => {
    render(<SendToMenu value={{ secret: "keep local" }} source="JSON subtree" />)
    fireEvent.pointerDown(screen.getByRole("button", { name: "continue · JSON subtree" }), { button: 0, ctrlKey: false })
    fireEvent.click(screen.getByRole("menuitem", { name: "journey" }))
    const url = push.mock.calls[0][0] as string
    expect(url).toMatch(/^\/journey#handoff=transfer-/)
    expect(url).not.toContain("secret")
    expect(toolTransfers.take(toolTransferIdFromHash(url.split("#")[1])!)?.value).toEqual({ secret: "keep local" })
  })
})
