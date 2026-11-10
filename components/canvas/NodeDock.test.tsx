import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { NodeDock } from "./NodeDock"
import { useNodeLibrary } from "./use-node-library"

const { addNode, addSubgraph, getAllNodes, getNodeDefinition, screenToFlowPosition, storeState, viewport } = vi.hoisted(() => ({
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
  viewport: { desktop: true },
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

vi.mock("@/hooks/use-media-query", () => ({ useMediaQuery: () => viewport.desktop }))

vi.mock("@/hooks/use-translations", () => {
  const translate = (key: string) =>
    ({
      palette: "Palette",
      close: "Close",
      dockSearch: "Search",
      dockFrequent: "Frequent",
      frequentEmpty: "Nothing here yet.",
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
    })[key] ?? key
  return { useTranslations: () => translate }
})

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

/** 节点库的数据在画布那一层，这里照样从外面传进来 */
function Dock() {
  return <NodeDock library={useNodeLibrary()} />
}

/** 点竖栏上的一格（测试环境没有样式，竖栏和手机上的「节点库」按钮同时都在） */
const openPanel = (name: string) => fireEvent.click(screen.getByRole("button", { name }))
const addButtons = () => screen.queryAllByRole("button", { name: /^Add node:/ })

describe("NodeDock", () => {
  beforeEach(() => {
    localStorage.clear()
    addNode.mockReset()
    addSubgraph.mockReset()
    getAllNodes.mockReturnValue(NODE_DEFINITIONS)
    getNodeDefinition.mockReset()
    storeState.nodes = []
    storeState.selectedNodeId = null
    screenToFlowPosition.mockClear()
    viewport.desktop = true
  })

  it("stays out of the way until a rail entry is opened, then lists only that category", () => {
    render(<Dock />)
    expect(screen.queryByRole("complementary", { name: "Palette" })).not.toBeInTheDocument()
    expect(addButtons()).toHaveLength(0)

    openPanel("Crypto")
    expect(screen.getByRole("complementary", { name: "Palette" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: /Crypto/ })).toBeInTheDocument()
    expect(addButtons().map((button) => button.getAttribute("aria-label"))).toEqual(["Add node: Hash"])

    // 再点一次同一格就收起来；换一格则直接换内容
    openPanel("Data")
    expect(addButtons().map((button) => button.getAttribute("aria-label"))).toEqual(["Add node: JSON Format"])
    openPanel("Data")
    expect(screen.queryByRole("complementary", { name: "Palette" })).not.toBeInTheDocument()
  })

  it("leaves out categories that have no nodes", () => {
    render(<Dock />)
    expect(screen.queryByRole("button", { name: "Image" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Data" })).toBeInTheDocument()
  })

  it.each([
    ["Hash", "Add node: Hash"],
    ["payload", "Add node: JSON Format"],
    ["Crypto", "Add node: Hash"],
    ["json-format", "Add node: JSON Format"],
  ])("searches node metadata with %s", (query, expectedNode) => {
    render(<Dock />)
    openPanel("Search")

    fireEvent.change(screen.getByRole("searchbox", { name: "Search nodes…" }), {
      target: { value: query },
    })

    expect(screen.getByRole("button", { name: expectedNode })).toBeInTheDocument()
    expect(addButtons()).toHaveLength(1)
  })

  it("shows an empty result and lets the user clear the search", () => {
    render(<Dock />)
    openPanel("Search")
    const searchInput = screen.getByRole("searchbox", { name: "Search nodes…" })

    fireEvent.change(searchInput, { target: { value: "not-a-node" } })
    expect(screen.getByRole("status")).toHaveTextContent("No matching nodes.")

    fireEvent.click(screen.getByRole("button", { name: "Clear node search" }))
    expect(searchInput).toHaveValue("")
    expect(addButtons()).toHaveLength(2)
  })

  it("opens the search from the keyboard, and Escape clears the query before closing", () => {
    render(<Dock />)
    fireEvent.keyDown(window, { key: "k", ctrlKey: true })
    const searchInput = screen.getByRole("searchbox", { name: "Search nodes…" })

    fireEvent.change(searchInput, { target: { value: "hash" } })
    fireEvent.keyDown(searchInput, { key: "Escape" })
    expect(searchInput).toHaveValue("")
    expect(screen.getByRole("complementary", { name: "Palette" })).toBeInTheDocument()

    fireEvent.keyDown(searchInput, { key: "Escape" })
    expect(screen.queryByRole("complementary", { name: "Palette" })).not.toBeInTheDocument()
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

    render(<Dock />)
    openPanel("Search")
    screen.getByRole("button", { name: "Add node: Hash" }).click()
    // 桌面上列表留着，可以接着加下一个
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
    canvas.remove()
  })

  it("closes the list after adding on a phone, where it covers the canvas", () => {
    viewport.desktop = false
    render(<Dock />)
    fireEvent.click(screen.getByRole("button", { name: "Palette" }))
    fireEvent.click(screen.getByRole("button", { name: "Add node: Hash" }))

    expect(addNode).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole("complementary", { name: "Palette" })).not.toBeInTheDocument()
  })

  it("persists favorites and records recently used nodes", () => {
    render(<Dock />)
    openPanel("Frequent")
    expect(screen.getByText("Nothing here yet.")).toBeInTheDocument()

    openPanel("Search")
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

    // “常用”那一格只列这两组
    openPanel("Frequent")
    expect(screen.queryByText("Nothing here yet.")).not.toBeInTheDocument()
    expect(screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual([
      "Favorites1",
      "Recently used1",
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

    render(<Dock />)
    openPanel("Crypto")
    expect(screen.getByText("Continue from Source")).toBeInTheDocument()
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
