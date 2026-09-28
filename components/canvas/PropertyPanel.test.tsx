import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useCanvasStore } from "@/lib/canvas/store"
import { PropertyPanel } from "./PropertyPanel"

const download = vi.hoisted(() => vi.fn())
vi.mock("@/hooks/use-translations", () => ({ useTranslations: () => (key: string) => key }))
vi.mock("@/hooks/use-object-url", () => ({ useObjectUrl: (value: Blob | null) => (value ? "blob:thumbnail" : null) }))
vi.mock("@/lib/object-url", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/object-url")>()), downloadBlob: download }))
vi.mock("@/lib/canvas/registry", () => ({
  getNodeDefinition: () => ({
    type: "image-convert",
    label: "Image Convert",
    category: "image",
    icon: () => null,
    config: [],
    outputs: [
      { id: "image", name: "Image", dataType: "bytes" },
      { id: "summary", name: "Summary", dataType: "string" },
    ],
  }),
}))

describe("PropertyPanel outputs", () => {
  beforeEach(() => {
    download.mockClear()
    useCanvasStore.setState({
      nodes: [{ id: "convert-1", type: "image-convert", position: { x: 0, y: 0 }, config: {} }],
      selectedNodeId: "convert-1",
      nodeOutputs: { "convert-1": { image: new File(["png"], "photo.png", { type: "image/png" }), summary: "1 image" } },
      nodeErrors: {},
      nodeRunning: {},
      edges: [],
    })
  })

  it("offers file outputs as downloads with a thumbnail instead of copying 'name (size)'", () => {
    render(<PropertyPanel />)
    expect(screen.getByRole("img", { name: "Image" })).toHaveAttribute("src", "blob:thumbnail")
    expect(screen.queryByRole("button", { name: /copyOutput.*Image|Image.*copyOutput/ })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "downloadOutput: Image" }))
    expect(download).toHaveBeenCalledWith(expect.any(File), "photo.png")
  })

  it("still copies and downloads text outputs", () => {
    render(<PropertyPanel />)
    fireEvent.click(screen.getByRole("button", { name: "downloadOutput: Summary" }))
    expect(download).toHaveBeenCalledWith(expect.any(Blob), "Image-Convert-Summary.txt")
    expect(screen.getAllByRole("button", { name: "copyOutput" })).toHaveLength(1)
  })
})
