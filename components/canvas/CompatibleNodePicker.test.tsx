import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NodeDefinition } from "@/lib/canvas/types"
import { CompatibleNodePicker } from "./CompatibleNodePicker"

const { getAllNodes } = vi.hoisted(() => ({ getAllNodes: vi.fn() }))

vi.mock("@/lib/canvas/registry", () => ({ getAllNodes }))

vi.mock("@/hooks/use-translations", () => ({
  useTranslations: () => (key: string) =>
    ({
      close: "Close",
      compatibleNodePickerTitle: "Choose the next node",
      compatibleNodePickerDescription: "Only nodes that accept {type} output are shown.",
      compatibleNodeSearchPlaceholder: "Search compatible nodes…",
      noCompatibleNodes: "No compatible nodes found.",
      targetInput: "Connect to input",
      sourceNodePickerTitle: "Choose the previous node",
      sourceNodePickerDescription: "Only nodes that can output {type} are shown.",
      sourceOutput: "Use output",
      addAndConnect: "Add and connect",
      categoryBasic: "Basic",
      categoryCrypto: "Crypto",
      categoryData: "Data",
      categoryImage: "Image",
      categoryText: "Text",
      categoryDev: "Dev",
      categoryUtility: "Utility",
      categoryViewer: "Viewer",
    })[key] ?? key,
}))

function TestIcon({ className }: { className?: string }) {
  return <svg aria-hidden="true" className={className} />
}

const DEFINITIONS: NodeDefinition[] = [
  {
    type: "converter",
    category: "utility",
    label: "Converter",
    description: "Convert a number",
    icon: TestIcon,
    config: [
      { id: "label", name: "Label", dataType: "string", hasInput: true },
      { id: "amount", name: "Amount", dataType: "number", hasInput: true },
    ],
    outputs: [],
    execute: vi.fn(),
  },
  {
    type: "parser",
    category: "data",
    label: "Parser",
    icon: TestIcon,
    config: [
      { id: "raw", name: "Raw", dataType: "bytes", hasInput: true },
      { id: "strict", name: "Strict", dataType: "boolean", hasOutput: true },
    ],
    outputs: [
      { id: "text", name: "Text", dataType: "string" },
      { id: "size", name: "Size", dataType: "number" },
    ],
    execute: vi.fn(),
  },
  {
    type: "bytes-only",
    category: "data",
    label: "Bytes only",
    icon: TestIcon,
    config: [
      { id: "file", name: "File", dataType: "bytes", hasInput: true },
    ],
    outputs: [],
    execute: vi.fn(),
  },
]

describe("CompatibleNodePicker", () => {
  beforeEach(() => {
    getAllNodes.mockReturnValue(DEFINITIONS)
  })

  it("shows only compatible nodes and prefers the exact input type", async () => {
    render(
      <CompatibleNodePicker
        dataType="number"
        position={{ x: 400, y: 240 }}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />
    )

    expect(screen.getByRole("heading", { name: "Choose the next node" })).toBeInTheDocument()
    expect(screen.getByText("Only nodes that accept number output are shown.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Add and connect: Converter" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Add and connect: Bytes only" })).not.toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "Connect to input: Converter" })).toHaveValue("amount")
    await waitFor(() => {
      expect(screen.getByRole("searchbox", { name: "Search compatible nodes…" })).toHaveFocus()
    })
  })

  it("lets the user choose a different compatible input before selecting", () => {
    const onSelect = vi.fn()
    render(
      <CompatibleNodePicker
        dataType="number"
        position={{ x: 400, y: 240 }}
        onSelect={onSelect}
        onClose={vi.fn()}
      />
    )

    fireEvent.change(
      screen.getByRole("combobox", { name: "Connect to input: Converter" }),
      { target: { value: "label" } }
    )
    fireEvent.click(screen.getByRole("button", { name: "Add and connect: Converter" }))

    expect(onSelect).toHaveBeenCalledWith({
      nodeType: "converter",
      portId: "label",
    })
  })

  it("searches by node type and localized category and reports empty results", () => {
    render(
      <CompatibleNodePicker
        dataType="number"
        position={{ x: 400, y: 240 }}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />
    )
    const input = screen.getByRole("searchbox", { name: "Search compatible nodes…" })

    fireEvent.change(input, { target: { value: "Utility" } })
    expect(screen.getByRole("button", { name: "Add and connect: Converter" })).toBeInTheDocument()

    fireEvent.change(input, { target: { value: "converter" } })
    expect(screen.getByRole("button", { name: "Add and connect: Converter" })).toBeInTheDocument()

    fireEvent.change(input, { target: { value: "missing" } })
    expect(screen.getByRole("status")).toHaveTextContent("No compatible nodes found.")
  })

  it("lists the nodes that can feed an input when asked for the previous step", () => {
    const onSelect = vi.fn()
    render(
      <CompatibleNodePicker
        dataType="number"
        direction="upstream"
        position={{ x: 400, y: 240 }}
        onSelect={onSelect}
        onClose={vi.fn()}
      />
    )

    expect(screen.getByRole("heading", { name: "Choose the previous node" })).toBeInTheDocument()
    expect(screen.getByText("Only nodes that can output number are shown.")).toBeInTheDocument()
    // 只有 Parser 有输出；Converter、Bytes only 只有输入
    expect(screen.getAllByRole("button", { name: /^Add and connect:/ }).map((button) => button.getAttribute("aria-label"))).toEqual([
      "Add and connect: Parser",
    ])
    // 默认用类型一致的那个输出，也可以换成别的
    const output = screen.getByRole("combobox", { name: "Use output: Parser" })
    expect(output).toHaveValue("size")
    fireEvent.change(output, { target: { value: "text" } })
    fireEvent.click(screen.getByRole("button", { name: "Add and connect: Parser" }))

    expect(onSelect).toHaveBeenCalledWith({ nodeType: "parser", portId: "text" })
  })

  it("closes with Escape or the close button", () => {
    const onClose = vi.fn()
    const firstRender = render(
      <CompatibleNodePicker
        dataType="number"
        position={{ x: 400, y: 240 }}
        onSelect={vi.fn()}
        onClose={onClose}
      />
    )

    fireEvent.keyDown(document, { key: "Escape" })
    expect(onClose).toHaveBeenCalledTimes(1)

    firstRender.unmount()
    onClose.mockClear()
    render(
      <CompatibleNodePicker
        dataType="number"
        position={{ x: 400, y: 240 }}
        onSelect={vi.fn()}
        onClose={onClose}
      />
    )
    fireEvent.click(screen.getByRole("button", { name: "Close" }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("closes when the backdrop is pressed", async () => {
    const onClose = vi.fn()
    render(
      <CompatibleNodePicker
        dataType="number"
        position={{ x: 400, y: 240 }}
        onSelect={vi.fn()}
        onClose={onClose}
      />
    )

    fireEvent.pointerDown(screen.getByTestId("compatible-node-picker-overlay"))
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })
})
