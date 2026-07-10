import { describe, expect, it, vi } from "vitest"
import type { ConfigField, NodeDefinition } from "./types"
import {
  filterCompatibleNodeOptions,
  getCompatibleNodeOptions,
} from "./compatible-nodes"

function TestIcon() {
  return null
}

function definition(
  type: string,
  category: NodeDefinition["category"],
  config: ConfigField[],
  extras: Partial<Pick<NodeDefinition, "label" | "description">> = {}
): NodeDefinition {
  return {
    type,
    category,
    label: extras.label ?? type,
    description: extras.description,
    icon: TestIcon,
    config,
    outputs: [],
    execute: vi.fn(),
  }
}

describe("getCompatibleNodeOptions", () => {
  it("uses the shared validator and excludes nodes without a compatible input", () => {
    const definitions = [
      definition("mixed", "data", [
        { id: "flag", name: "Flag", dataType: "boolean", hasInput: true },
        { id: "label", name: "Label", dataType: "string", hasInput: true },
      ]),
      definition("bytes-only", "data", [
        { id: "file", name: "File", dataType: "bytes", hasInput: true },
      ]),
      definition("not-connectable", "data", [
        { id: "value", name: "Value", dataType: "number", hasInput: false },
      ]),
    ]

    const options = getCompatibleNodeOptions("number", definitions)

    expect(options).toHaveLength(1)
    expect(options[0].definition.type).toBe("mixed")
    expect(options[0].compatibleInputs.map((field) => field.id)).toEqual(["label"])
  })

  it("prefers an exact type for the default port while preserving all compatible inputs", () => {
    const options = getCompatibleNodeOptions("number", [
      definition("converter", "utility", [
        { id: "label", name: "Label", dataType: "string", hasInput: true },
        { id: "amount", name: "Amount", dataType: "number", hasInput: true },
      ]),
    ])

    expect(options[0].compatibleInputs.map((field) => field.id)).toEqual([
      "label",
      "amount",
    ])
    expect(options[0].defaultTargetPortId).toBe("amount")
  })

  it("ranks nodes with an exact input ahead of conversion-only matches", () => {
    const options = getCompatibleNodeOptions("string", [
      definition("number-only", "basic", [
        { id: "amount", name: "Amount", dataType: "number", hasInput: true },
      ]),
      definition("string-input", "text", [
        { id: "value", name: "Value", dataType: "string", hasInput: true },
      ]),
    ])

    expect(options.map((option) => option.definition.type)).toEqual([
      "string-input",
      "number-only",
    ])
  })
})

describe("filterCompatibleNodeOptions", () => {
  const options = getCompatibleNodeOptions("string", [
    definition(
      "hash-text",
      "crypto",
      [{ id: "value", name: "Value", dataType: "string", hasInput: true }],
      { label: "Hash", description: "Create a digest" }
    ),
    definition(
      "json-format",
      "data",
      [{ id: "value", name: "Value", dataType: "string", hasInput: true }],
      { label: "JSON Format" }
    ),
  ])

  it.each([
    ["Hash", "hash-text"],
    ["digest", "hash-text"],
    ["json-format", "json-format"],
    ["crypto", "hash-text"],
    ["加密", "hash-text"],
  ])("searches node metadata with %s", (query, expectedType) => {
    const filtered = filterCompatibleNodeOptions(
      options,
      query,
      (category) => category === "crypto"
        ? "加密"
        : category === "data"
          ? "数据"
          : category
    )

    expect(filtered.map((option) => option.definition.type)).toEqual([expectedType])
  })

  it("returns a new registry-ordered array for an empty query", () => {
    const filtered = filterCompatibleNodeOptions(options, "  ")
    expect(filtered.map((option) => option.definition.type)).toEqual([
      "hash-text",
      "json-format",
    ])
    expect(filtered).not.toBe(options)
  })
})
