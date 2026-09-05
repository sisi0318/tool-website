import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import UrlPage from "./page"

vi.mock("@/hooks/use-translations", () => { const translate = (key: string) => key; return { useTranslations: () => translate } })
vi.mock("@/hooks/use-object-url", () => ({ useObjectUrl: () => null }))
vi.mock("@/components/tools/send-to-menu", () => ({ SendToMenu: () => null }))

describe("URL editor", () => {
  it("keeps edited repeated parameters attached to their rows during reorder and invalidates incorrect output", () => {
    render(<UrlPage />)
    fireEvent.change(screen.getByRole("textbox", { name: "input" }), { target: { value: "https://example.com/?tag=one&tag=two&q=a+b" } })
    fireEvent.click(screen.getByRole("button", { name: "parse" }))
    fireEvent.change(screen.getByRole("textbox", { name: "value 2" }), { target: { value: "中 &+" } })
    fireEvent.click(screen.getByRole("button", { name: "moveUp 2" }))
    expect(screen.getByRole("textbox", { name: "value 1" })).toHaveValue("中 &+")
    expect(screen.getByRole("textbox", { name: "output" })).toHaveValue("https://example.com/?tag=%E4%B8%AD%20%26%2B&tag=one&q=a+b")
    fireEvent.click(screen.getByRole("checkbox", { name: "enabled 1" }))
    expect(screen.getByRole("textbox", { name: "output" })).toHaveValue("https://example.com/?tag=one&q=a+b")
    fireEvent.change(screen.getByRole("textbox", { name: "port" }), { target: { value: "70000" } })
    expect(screen.getByRole("alert")).toHaveTextContent("errors.invalidPort")
    expect(screen.getByRole("textbox", { name: "output" })).toHaveValue("")
    expect(screen.getByRole("button", { name: "copy" })).toBeDisabled()
    fireEvent.change(screen.getByRole("textbox", { name: "input" }), { target: { value: "bad" } })
    expect(screen.queryByRole("textbox", { name: "output" })).not.toBeInTheDocument()
  })
})
