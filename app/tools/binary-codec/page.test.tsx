import React from "react"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import BinaryCodecPage from "./page"
import { processBinaryCodec, type BinaryCodecResult } from "@/lib/binary-codec-tools"
import { BINARY_CODEC_LIMITS } from "@/lib/binary-codecs"

vi.mock("@/hooks/use-translations", () => { const translate = (key: string) => key; return { useTranslations: () => translate } })
vi.mock("@/hooks/use-object-url", () => ({ useObjectUrl: (file: File | null) => file ? "blob:test-codec" : null }))
vi.mock("@/components/tools/send-to-menu", () => ({ SendToMenu: () => null }))
vi.mock("@/components/json-tree-view", () => ({ JsonTreeView: ({ jsonText }: { jsonText: string }) => <pre data-testid="decoded-json">{jsonText}</pre> }))
vi.mock("@/lib/binary-codec-tools", async (original) => { const codecModule = await original<typeof import("@/lib/binary-codec-tools")>(); return { ...codecModule, processBinaryCodec: vi.fn(codecModule.processBinaryCodec) } })
afterEach(() => { vi.clearAllMocks(); window.history.replaceState(null, "", "/") })

describe("binary codec page", () => {
  it("decodes an independent MessagePack sample and reverses it to a downloadable binary file", async () => {
    render(<BinaryCodecPage />)
    fireEvent.change(screen.getByRole("textbox", { name: "input" }), { target: { value: "82a16101a162920203" } })
    fireEvent.click(screen.getByRole("button", { name: "run" }))
    expect(await screen.findByTestId("decoded-json")).toHaveTextContent('"a": 1')
    fireEvent.click(screen.getByRole("button", { name: "reverse" }))
    expect(screen.getByRole("textbox", { name: "input" })).toHaveValue(JSON.stringify({ a: 1, b: [2, 3] }, null, 2))
    fireEvent.click(screen.getByRole("button", { name: "run" }))
    expect(await screen.findByRole("link", { name: "downloadBinary" })).toHaveAttribute("download", "data.msgpack")
    expect(screen.getByText("82a16101a162920203")).toBeInTheDocument()
  })
  it("does not commit an older job after the input changes", async () => {
    let resolve!: (result: BinaryCodecResult) => void
    vi.mocked(processBinaryCodec).mockImplementationOnce(() => new Promise((done) => { resolve = done }))
    render(<BinaryCodecPage />)
    fireEvent.change(screen.getByRole("textbox", { name: "input" }), { target: { value: "00" } })
    fireEvent.click(screen.getByRole("button", { name: "run" }))
    await waitFor(() => expect(processBinaryCodec).toHaveBeenCalled())
    fireEvent.change(screen.getByRole("textbox", { name: "input" }), { target: { value: "01" } })
    await act(async () => resolve({ output: "0", value: 0, byteLength: 1, file: new File([new Uint8Array([0])], "data.msgpack") }))
    expect(screen.queryByTestId("decoded-json")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "reverse" })).not.toBeInTheDocument()
  })
  it("drops a previous file when a new selection exceeds the limit", () => {
    render(<BinaryCodecPage />)
    fireEvent.change(screen.getByLabelText("chooseFile"), { target: { files: [new File(["a"], "old.cbor")] } })
    expect(screen.getByRole("textbox", { name: "input" })).toBeDisabled()
    const oversized = new File([], "large.cbor"); Object.defineProperty(oversized, "size", { value: BINARY_CODEC_LIMITS.bytes + 1 })
    fireEvent.change(screen.getByLabelText("chooseFile"), { target: { files: [oversized] } })
    expect(screen.getByRole("alert")).toHaveTextContent("errors.limit")
    expect(screen.getByRole("textbox", { name: "input" })).not.toBeDisabled()
    expect(screen.queryByText(/old.cbor/)).not.toBeInTheDocument()
  })
})
