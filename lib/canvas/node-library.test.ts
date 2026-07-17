import { describe, expect, it } from "vitest"
import type { NodeDefinition } from "./types"
import {
  getAutoConnectPlan,
  loadNodeLibraryPreferences,
  recordRecentNodeType,
  searchNodeDefinitions,
  toggleFavoriteNodeType,
} from "./node-library"

function definition(
  type: string,
  label: string,
  description: string,
  inputType: "string" | "number" | "json" = "string",
  outputType: "string" | "number" | "json" = "string"
): NodeDefinition {
  return {
    type,
    label,
    description,
    category: type === "hash" ? "crypto" : "data",
    icon: () => null,
    config: [{ id: "input", name: "Input", dataType: inputType, hasInput: true }],
    outputs: [{ id: "output", name: "Output", dataType: outputType }],
    execute: async () => ({}),
  }
}

const DEFINITIONS = [
  definition("json-format", "JSON Format", "Pretty-print a payload", "json", "string"),
  definition("hash", "Hash", "Create a digest from text"),
  definition("text-stats", "Text Stats", "Count characters and words"),
]

describe("canvas node library", () => {
  it("loads only registered, unique favourites and recent nodes", () => {
    const values = new Map([
      ["canvas-favorite-nodes", JSON.stringify(["hash", "missing", "hash"])],
      ["canvas-recent-nodes", JSON.stringify(["text-stats", "missing", "hash"])],
    ])

    expect(loadNodeLibraryPreferences(DEFINITIONS, {
      getItem: (key) => values.get(key) ?? null,
    })).toEqual({
      favorites: ["hash"],
      recent: ["text-stats", "hash"],
    })
  })

  it("keeps recent nodes unique and most-recent first", () => {
    expect(recordRecentNodeType(["hash", "json-format"], "json-format", 3)).toEqual([
      "json-format",
      "hash",
    ])
    expect(recordRecentNodeType(["a", "b", "c"], "d", 3)).toEqual(["d", "a", "b"])
  })

  it("toggles favourites without changing the other entries", () => {
    expect(toggleFavoriteNodeType(["hash"], "json-format")).toEqual([
      "hash",
      "json-format",
    ])
    expect(toggleFavoriteNodeType(["hash", "json-format"], "hash")).toEqual([
      "json-format",
    ])
  })

  it("ranks exact labels ahead of description-only matches", () => {
    const getCategoryLabel = (category: NodeDefinition["category"]) =>
      category === "crypto" ? "Encryption" : "Data"
    const matches = searchNodeDefinitions(DEFINITIONS, "hash", getCategoryLabel)

    expect(matches.map((item) => item.type)).toEqual(["hash"])
    expect(searchNodeDefinitions(DEFINITIONS, "text digest").map((item) => item.type)).toEqual([
      "hash",
    ])
    expect(searchNodeDefinitions(DEFINITIONS, "encryption", getCategoryLabel).map((item) => item.type)).toEqual([
      "hash",
    ])
    expect(searchNodeDefinitions(DEFINITIONS, "jsn fmt").map((item) => item.type)).toEqual([
      "json-format",
    ])
  })

  it("prefers exact data types when choosing an automatic connection", () => {
    const source: NodeDefinition = {
      ...definition("source", "Source", "", "string", "string"),
      outputs: [
        { id: "json", name: "JSON", dataType: "json" },
        { id: "text", name: "Text", dataType: "string" },
      ],
    }
    const target: NodeDefinition = {
      ...definition("target", "Target", "", "string", "string"),
      config: [
        { id: "as-text", name: "Text", dataType: "string", hasInput: true },
        { id: "as-json", name: "JSON", dataType: "json", hasInput: true },
      ],
    }

    expect(getAutoConnectPlan(source, target)).toEqual({
      sourcePortId: "json",
      targetPortId: "as-json",
    })
  })
})
