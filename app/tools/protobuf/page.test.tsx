import React from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import ProtobufPage from "./page"
import { bytesToBase64, bytesToHex } from "@/lib/binary"
import { encodeProtobuf } from "@/lib/protobuf-tools"

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

describe("Protobuf text display", () => {
  it("switches between conservative and UTF-8 output without changing the input", async () => {
    render(<ProtobufPage />)
    const input = screen.getByLabelText("input")
    const output = screen.getByPlaceholderText("decodeResultPlaceholder")
    fireEvent.change(input, { target: { value: "0a0668656c6c6f00" } })
    await waitFor(() => expect(output).toHaveValue(JSON.stringify({ "1": "aGVsbG8A" }, null, 4)))
    expect(screen.getByRole("radio", { name: "readableText" })).toBeChecked()

    fireEvent.click(screen.getByRole("radio", { name: "utf8Text" }))
    await waitFor(() => expect(output).toHaveValue(JSON.stringify({ "1": "hello\u0000" }, null, 4)))
    expect(input).toHaveValue("0a0668656c6c6f00")

    fireEvent.click(screen.getByRole("radio", { name: "readableText" }))
    await waitFor(() => expect(output).toHaveValue(JSON.stringify({ "1": "aGVsbG8A" }, null, 4)))
  })

  it("refreshes the selected display mode for large manually parsed inputs", async () => {
    const text = "hello\u0000".repeat(1000)
    const input = bytesToHex(await encodeProtobuf(JSON.stringify({ "1": text })))
    render(<ProtobufPage />)
    const output = screen.getByPlaceholderText("decodeResultPlaceholder")
    fireEvent.change(screen.getByLabelText("input"), { target: { value: input } })
    fireEvent.click(screen.getByRole("button", { name: "parse" }))
    await waitFor(() => expect(output).toHaveValue(JSON.stringify({ "1": bytesToBase64(new TextEncoder().encode(text)) }, null, 4)))

    fireEvent.click(screen.getByRole("radio", { name: "utf8Text" }))
    await waitFor(() => expect(output).toHaveValue(JSON.stringify({ "1": text }, null, 4)))
  })

  it("keeps schema bytes in their original JSON representation", async () => {
    render(<ProtobufPage />)
    fireEvent.click(screen.getByRole("radio", { name: "utf8Text" }))
    fireEvent.click(screen.getByRole("radio", { name: /schemaMode/ }))
    expect(screen.queryByRole("radiogroup", { name: "textDisplayMode" })).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText("protoContent"), { target: { value: 'syntax = "proto3"; message Demo { bytes body = 1; }' } })
    await screen.findByLabelText("messageType")
    fireEvent.change(screen.getByLabelText("input"), { target: { value: "0a0668656c6c6f00" } })
    const output = screen.getByPlaceholderText("decodeResultPlaceholder")
    await waitFor(() => expect(output).toHaveValue(JSON.stringify({ body: "aGVsbG8A" }, null, 4)))

    fireEvent.click(screen.getByRole("radio", { name: /schemalessMode/ }))
    expect(screen.getByRole("radio", { name: "utf8Text" })).toBeChecked()
    await waitFor(() => expect(output).toHaveValue(JSON.stringify({ "1": "hello\u0000" }, null, 4)))
  })
})
