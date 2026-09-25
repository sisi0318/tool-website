import React from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import XmlToolsPage from "./page"

vi.mock("@/hooks/use-translations", () => { const translate = (key: string) => key; return { useTranslations: () => translate } })
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock("@/components/tools/send-to-menu", () => ({ SendToMenu: () => null }))

describe("XML errors", () => {
  beforeEach(() => window.sessionStorage.clear())

  it("says what is wrong and where instead of a bare failure", async () => {
    render(<XmlToolsPage />)
    const input = screen.getByRole("textbox", { name: "input" })
    fireEvent.change(input, { target: { value: "<root>\n  <item>\n</root>" } })
    fireEvent.click(screen.getByRole("button", { name: "run" }))
    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("failed")
    expect(alert).toHaveTextContent(/Invalid XML: .+/)
    await waitFor(() => expect(screen.getByRole("button", { name: "revealError" })).toBeInTheDocument())
  })
})
