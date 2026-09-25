import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import ProtobufPage from "./page"

vi.mock("@/hooks/use-translations", () => { const translate = (key: string) => key; return { useTranslations: () => translate } })
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock("@/components/tools/send-to-menu", () => ({ SendToMenu: () => null }))

describe("proto definition errors", () => {
  it("shows protobufjs' reason and line instead of only logging it", async () => {
    render(<ProtobufPage />)
    fireEvent.click(screen.getByRole("radio", { name: /schemaMode/ }))
    fireEvent.change(screen.getByLabelText("protoContent"), { target: { value: 'syntax = "proto3";\nmessage Demo {\n  string name = ;\n}' } })
    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("protoParseError")
    expect(alert).toHaveTextContent("illegal id ';' (line 3)")
    expect(alert).toHaveTextContent("errorAtLine")
    expect(screen.getByRole("button", { name: "revealError" })).toBeInTheDocument()
  })
})
