import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { QuickAddMenu } from "./QuickAddMenu"
import type { NodeLibrary } from "./use-node-library"
import type { NodeDefinition } from "@/lib/canvas/types"

vi.mock("@/hooks/use-translations", () => { const translate = (key: string) => key; return { useTranslations: () => translate } })

const definition = (type: string, label: string, category: NodeDefinition["category"]): NodeDefinition => ({
  type,
  label,
  category,
  icon: (() => null) as never,
  config: [],
  outputs: [],
  execute: async () => ({}),
})

const TEXT = definition("string", "Text", "basic")
const HASH = definition("hash", "Hash", "crypto")
const HMAC = definition("hmac", "HMAC", "crypto")

function library(overrides: Partial<NodeLibrary> = {}): NodeLibrary {
  const allNodes = [TEXT, HASH, HMAC]
  return {
    allNodes,
    favorites: [],
    recent: [],
    categories: [
      { id: "basic", label: "Basic", nodes: [TEXT] },
      { id: "crypto", label: "Crypto", nodes: [HASH, HMAC] },
    ],
    isFavorite: () => false,
    toggleFavorite: vi.fn(),
    recordUse: vi.fn(),
    search: (query) => allNodes.filter((node) => node.label.toLowerCase().includes(query.toLowerCase())),
    categoryLabel: (category) => category,
    ...overrides,
  }
}

function open(overrides: Partial<NodeLibrary> = {}) {
  const onPick = vi.fn()
  const onClose = vi.fn()
  render(<QuickAddMenu library={library(overrides)} position={{ x: 300, y: 200 }} onPick={onPick} onClose={onClose} />)
  return { onPick, onClose, input: screen.getByRole("combobox", { name: "addNode" }) }
}

const optionNames = () => screen.getAllByRole("option").map((option) => option.textContent)
const selectedOption = () => screen.getByRole("option", { selected: true }).textContent

describe("QuickAddMenu", () => {
  it("lists every node by category with the first one ready to add", () => {
    const { input, onPick } = open()
    expect(input).toHaveFocus()
    expect(optionNames()).toEqual(["Text", "Hash", "HMAC"])
    expect(screen.getByRole("group", { name: "Crypto" })).toBeInTheDocument()

    fireEvent.keyDown(input, { key: "Enter" })
    expect(onPick).toHaveBeenCalledWith("string")
  })

  it("puts favorites and recently used nodes ahead of the categories", () => {
    open({ favorites: [HMAC], recent: [HASH] })
    expect(optionNames()).toEqual(["HMAC", "Hash", "Text", "Hash", "HMAC"])
    expect(selectedOption()).toBe("HMAC")
  })

  it("filters as you type and adds the best match on Enter", () => {
    const { input, onPick } = open()
    fireEvent.change(input, { target: { value: "h" } })
    // 搜索结果里带上分类，免得同名的分不清
    expect(optionNames()).toEqual(["Hashcrypto", "HMACcrypto"])

    fireEvent.keyDown(input, { key: "Enter" })
    expect(onPick).toHaveBeenCalledWith("hash")
  })

  it("moves through the list with the arrow keys and wraps at both ends", () => {
    const { input, onPick } = open()
    fireEvent.keyDown(input, { key: "ArrowDown" })
    expect(selectedOption()).toBe("Hash")
    expect(input).toHaveAttribute("aria-activedescendant", screen.getByRole("option", { selected: true }).id)

    fireEvent.keyDown(input, { key: "ArrowUp" })
    fireEvent.keyDown(input, { key: "ArrowUp" })
    expect(selectedOption()).toBe("HMAC")

    fireEvent.keyDown(input, { key: "Enter" })
    expect(onPick).toHaveBeenCalledWith("hmac")
  })

  it("adds the node that was clicked", () => {
    const { onPick } = open()
    fireEvent.click(screen.getByRole("option", { name: "HMAC" }))
    expect(onPick).toHaveBeenCalledWith("hmac")
  })

  it("says so when nothing matches, and Enter then does nothing", () => {
    const { input, onPick } = open()
    fireEvent.change(input, { target: { value: "zzz" } })
    expect(screen.getByRole("status")).toHaveTextContent("noMatchingNodes")
    fireEvent.keyDown(input, { key: "Enter" })
    expect(onPick).not.toHaveBeenCalled()
  })

  it("closes on Escape without adding anything", () => {
    const { input, onPick, onClose } = open()
    fireEvent.keyDown(input, { key: "Escape" })
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onPick).not.toHaveBeenCalled()
  })
})
