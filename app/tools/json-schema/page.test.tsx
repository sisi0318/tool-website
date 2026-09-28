import React from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import JsonSchemaPage from "./page"

vi.mock("@/hooks/use-translations", () => { const translate = (key: string) => key; return { useTranslations: () => translate } })
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock("@/components/tools/send-to-menu", () => ({ SendToMenu: () => null }))

describe("JSON Schema validation", () => {
  beforeEach(() => window.sessionStorage.clear())

  it("loads the validator on the first run and still points schema errors at the schema field", async () => {
    render(<JsonSchemaPage />)
    fireEvent.change(screen.getByRole("textbox", { name: "jsonData" }), { target: { value: '{"id":"x"}' } })
    fireEvent.change(screen.getByLabelText("schema"), { target: { value: '{"type":"object","properties":{"id":{"type":"integer"}}}' } })
    fireEvent.click(screen.getByRole("button", { name: "run" }))
    await waitFor(() => expect(screen.getByText("invalid")).toBeInTheDocument())

    fireEvent.change(screen.getByLabelText("schema"), { target: { value: "{" } })
    fireEvent.click(screen.getByRole("button", { name: "run" }))
    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("failed")
    fireEvent.click(await screen.findByRole("button", { name: "revealError" }))
    expect(screen.getByLabelText("schema")).toHaveFocus()
  })
})
