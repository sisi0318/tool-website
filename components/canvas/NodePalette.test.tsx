import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { NodePalette } from "./NodePalette"

const { addNode, getAllNodes, screenToFlowPosition } = vi.hoisted(() => ({
  addNode: vi.fn(),
  getAllNodes: vi.fn(),
  screenToFlowPosition: vi.fn((position: { x: number; y: number }) => position),
}))

vi.mock("@xyflow/react", () => ({
  useReactFlow: () => ({ screenToFlowPosition }),
}))

vi.mock("@/lib/canvas/registry", () => ({ getAllNodes }))

vi.mock("@/lib/canvas/store", () => ({
  useCanvasStore: (selector: (state: { addNode: typeof addNode }) => unknown) =>
    selector({ addNode }),
}))

vi.mock("@/hooks/use-translations", () => ({
  useTranslations: () => (key: string) =>
    ({
      palette: "Palette",
      workflow: "Workflow",
      nodes: "Nodes",
      nodeSearchPlaceholder: "Search nodes…",
      clearNodeSearch: "Clear node search",
      noMatchingNodes: "No matching nodes.",
      addNode: "Add node",
      nodeAddHint: "Click to add, or drag onto the canvas",
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

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("./workflow/WorkflowNewButton", () => ({ WorkflowNewButton: () => null }))
vi.mock("./workflow/WorkflowSaveButton", () => ({ WorkflowSaveButton: () => null }))
vi.mock("./workflow/WorkflowLoadButton", () => ({ WorkflowLoadButton: () => null }))
vi.mock("./workflow/WorkflowTransferButtons", () => ({ WorkflowTransferButtons: () => null }))

function TestIcon() {
  return <svg aria-hidden="true" />
}

const NODE_DEFINITIONS = [
  {
    type: "hash-text",
    category: "crypto",
    label: "Hash",
    description: "Create a digest",
    icon: TestIcon,
    config: [],
    outputs: [],
    execute: vi.fn(),
  },
  {
    type: "json-format",
    category: "data",
    label: "JSON Format",
    description: "Pretty-print a payload",
    icon: TestIcon,
    config: [],
    outputs: [],
    execute: vi.fn(),
  },
]

describe("NodePalette", () => {
  beforeEach(() => {
    addNode.mockReset()
    getAllNodes.mockReturnValue(NODE_DEFINITIONS)
    screenToFlowPosition.mockClear()
  })

  it.each([
    ["Hash", "Add node: Hash"],
    ["payload", "Add node: JSON Format"],
    ["Crypto", "Add node: Hash"],
    ["json-format", "Add node: JSON Format"],
  ])("searches node metadata with %s", (query, expectedNode) => {
    render(<NodePalette />)

    fireEvent.change(screen.getByRole("searchbox", { name: "Search nodes…" }), {
      target: { value: query },
    })

    expect(screen.getByRole("button", { name: expectedNode })).toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: /^Add node:/ })).toHaveLength(1)
  })

  it("shows an empty result and lets the user clear the search", () => {
    render(<NodePalette />)
    const searchInput = screen.getByRole("searchbox", { name: "Search nodes…" })

    fireEvent.change(searchInput, { target: { value: "not-a-node" } })
    expect(screen.getByRole("status")).toHaveTextContent("No matching nodes.")

    fireEvent.click(screen.getByRole("button", { name: "Clear node search" }))
    expect(searchInput).toHaveValue("")
    expect(screen.getAllByRole("button", { name: /^Add node:/ })).toHaveLength(2)
  })

  it("adds clicked nodes near the visible canvas center with a cascade offset", () => {
    const canvas = document.createElement("div")
    canvas.dataset.testid = "canvas-drop-zone"
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      left: 200,
      top: 100,
      width: 800,
      height: 600,
      right: 1000,
      bottom: 700,
      x: 200,
      y: 100,
      toJSON: () => undefined,
    })
    document.body.appendChild(canvas)

    render(<NodePalette />)
    screen.getByRole("button", { name: "Add node: Hash" }).click()
    screen.getByRole("button", { name: "Add node: JSON Format" }).click()

    expect(screenToFlowPosition).toHaveBeenNthCalledWith(1, { x: 460, y: 340 })
    expect(screenToFlowPosition).toHaveBeenNthCalledWith(2, { x: 484, y: 364 })
    expect(addNode).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ type: "hash-text", position: { x: 460, y: 340 }, config: {} })
    )
    expect(addNode).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ type: "json-format", position: { x: 484, y: 364 }, config: {} })
    )
  })
})
