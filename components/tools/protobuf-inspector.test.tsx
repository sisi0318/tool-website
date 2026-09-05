import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ProtobufInspector } from "./protobuf-inspector"
import { inspectProtobuf } from "@/lib/protobuf-tools"
import { hexToBytes } from "@/lib/binary"

vi.mock("@/hooks/use-translations", () => ({ useTranslations: () => (key: string) => key }))

describe("Protobuf inspector", () => {
  it("links nested field selection to bytes and byte selection back to the field", () => {
    const { container } = render(<ProtobufInspector inspection={inspectProtobuf(hexToBytes("080112020803"))} onValueChange={vi.fn()} />)
    fireEvent.click(screen.getByRole("button", { name: "field 2.1 · 4" }))
    expect(container.querySelector('[data-byte-offset="4"]')).toHaveAttribute("data-highlight", "header")
    expect(container.querySelector('[data-byte-offset="5"]')).toHaveAttribute("data-highlight", "payload")
    expect(container.querySelector('[data-byte-offset="2"]')).not.toHaveAttribute("data-highlight")
    fireEvent.click(screen.getByRole("button", { name: "byte 0: 08" }))
    expect(screen.getByRole("button", { name: "field 1 · 0" })).toHaveAttribute("aria-pressed", "true")
  })

  it("updates the JSON interpretation and preserves the previous result on invalid packed data", () => {
    const onValueChange = vi.fn()
    render(<ProtobufInspector inspection={inspectProtobuf(hexToBytes("0a03010203"))} onValueChange={onValueChange} />)
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "packedSint" } })
    expect(onValueChange).toHaveBeenLastCalledWith({ "1": [-1, 1, -2] })
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "packedFloat" } })
    expect(screen.getByRole("alert")).toHaveTextContent("invalidInterpretation")
    expect(screen.getByRole("combobox")).toHaveValue("packedSint")
    expect(onValueChange).toHaveBeenCalledTimes(1)
  })

  it("paginates bytes and fields and locates a selected field on the correct byte page", () => {
    const { container } = render(<ProtobufInspector inspection={inspectProtobuf(hexToBytes("0801".repeat(150)))} onValueChange={vi.fn()} />)
    expect(container.querySelectorAll("[data-byte-offset]")).toHaveLength(256)
    fireEvent.click(screen.getByRole("button", { name: "nextFields" }))
    fireEvent.click(screen.getByRole("button", { name: "nextFields" }))
    fireEvent.click(screen.getByRole("button", { name: "field 1[149] · 298" }))
    expect(container.querySelectorAll("[data-byte-offset]")).toHaveLength(44)
    expect(container.querySelector('[data-byte-offset="298"]')).toHaveAttribute("data-highlight", "header")
  })

  it("keeps schema-based JSON read-only", () => {
    render(<ProtobufInspector inspection={inspectProtobuf(hexToBytes("0801"))} readOnly onValueChange={vi.fn()} />)
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument()
  })
})
