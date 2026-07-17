import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { NodePalette } from "./NodePalette"

const { addNode, addSubgraph, getAllNodes, getNodeDefinition, screenToFlowPosition, storeState } = vi.hoisted(() => ({
  addNode: vi.fn(),
  addSubgraph: vi.fn(),
  getAllNodes: vi.fn(),
  getNodeDefinition: vi.fn(),
  screenToFlowPosition: vi.fn((position: { x: number; y: number }) => position),
  storeState: {
    addNode: vi.fn(),
    addSubgraph: vi.fn(),
    nodes: [] as Array<{ id: string; type: string; position: { x: number; y: number }; config: Record<string, unknown> }>,
    selectedNodeId: null as string | null,
  },
}))

storeState.addNode = addNode
storeState.addSubgraph = addSubgraph

vi.mock("@xyflow/react", () => ({
  useReactFlow: () => ({ screenToFlowPosition }),
}))

vi.mock("@/lib/canvas/registry", () => ({ getAllNodes, getNodeDefinition }))

vi.mock("@/lib/canvas/store", () => ({
  useCanvasStore: (selector: (state: typeof storeState) => unknown) =>
    selector(storeState),
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
      searchResults: "{count} search results",
      favoriteNodes: "Favorites",
      recentNodes: "Recently used",
      addFavoriteNode: "Add node to favorites",
      removeFavoriteNode: "Remove node from favorites",
      addNode: "Add node",
      nodeAddHint: "Click to add, or drag onto the canvas",
      appendFromNode: "Continue from {node}",
      addAndConnectAfter: "Add after selected node and connect",
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
    config: [{ id: "data", name: "Data", dataType: "string", hasInput: true }],
    outputs: [{ id: "hash", name: "Hash", dataType: "string" }],
    execute: vi.fn(),
  },
  {
    type: "json-format",
    category: "data",
    label: "JSON Format",
    description: "Pretty-print a payload",
    icon: TestIcon,
    config: [{ id: "input", name: "Input", dataType: "json", hasInput: true }],
    outputs: [{ id: "output", name: "Output", dataType: "string" }],
    execute: vi.fn(),
  },
]

describe("NodePalette", () => {
  beforeEach(() => {
    localStorage.clear()
    addNode.mockReset()
    addSubgraph.mockReset()
    getAllNodes.mockReturnValue(NODE_DEFINITIONS)
    getNodeDefinition.mockReset()
    storeState.nodes = []
    storeState.selectedNodeId = null
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

  it("persists favorites and records recently used nodes", () => {
    render(<NodePalette />)

    fireEvent.click(screen.getByRole("button", { name: "Add node to favorites: Hash" }))
    expect(screen.getByRole("heading", { name: /Favorites/ })).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem("canvas-favorite-nodes") ?? "[]")).toEqual([
      "hash-text",
    ])

    fireEvent.click(screen.getAllByRole("button", { name: "Add node: Hash" })[0])
    expect(screen.getByRole("heading", { name: /Recently used/ })).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem("canvas-recent-nodes") ?? "[]")).toEqual([
      "hash-text",
    ])
  })

  it("adds a compatible node after the selected source and connects it", () => {
    const sourceDefinition = {
      type: "source",
      category: "basic",
      label: "Source",
      icon: TestIcon,
      config: [],
      outputs: [{ id: "value", name: "Value", dataType: "string" }],
      execute: vi.fn(),
    }
    storeState.nodes = [{
      id: "source-node",
      type: "source",
      position: { x: 100, y: 200 },
      config: {},
    }]
    storeState.selectedNodeId = "source-node"
    getNodeDefinition.mockReturnValue(sourceDefinition)

    render(<NodePalette />)
    fireEvent.click(screen.getByRole("button", {
      name: "Add after selected node and connect: Hash",
    }))

    expect(addSubgraph).toHaveBeenCalledWith({
      nodes: [expect.objectContaining({
        type: "hash-text",
        position: { x: 460, y: 200 },
      })],
      edges: [expect.objectContaining({
        source: "source-node",
        sourcePort: "value",
        targetPort: "data",
      })],
    })
  })
})
