import React from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import SqlPage from "./page"

vi.mock("@/hooks/use-translations", () => { const translate = (key: string) => key; return { useTranslations: () => translate } })
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock("@/components/tools/send-to-menu", () => ({ SendToMenu: () => null }))

describe("SQL formatter", () => {
  beforeEach(() => window.sessionStorage.clear())

  it("loads the formatter on the first run and formats the query", async () => {
    render(<SqlPage />)
    fireEvent.change(screen.getByRole("textbox", { name: "SQL" }), { target: { value: "select a from b" } })
    fireEvent.click(screen.getByRole("button", { name: "run" }))
    await waitFor(() => expect(screen.getByPlaceholderText("outputPlaceholder")).toHaveValue("SELECT\n  a\nFROM\n  b"))
  })
})
