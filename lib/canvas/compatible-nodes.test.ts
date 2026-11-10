import { describe, expect, it, vi } from "vitest"
import type { ConfigField, NodeDefinition } from "./types"
import {
  filterCompatibleNodeOptions,
  getCompatibleNodeOptions,
  getCompatibleSourceOptions,
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
    expect(options[0].ports.map((field) => field.id)).toEqual(["label"])
  })

  it("prefers an exact type for the default port while preserving all compatible inputs", () => {
    const options = getCompatibleNodeOptions("number", [
      definition("converter", "utility", [
        { id: "label", name: "Label", dataType: "string", hasInput: true },
        { id: "amount", name: "Amount", dataType: "number", hasInput: true },
      ]),
    ])

    expect(options[0].ports.map((field) => field.id)).toEqual([
      "label",
      "amount",
    ])
    expect(options[0].defaultPortId).toBe("amount")
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

describe("getCompatibleSourceOptions", () => {
  const source = (type: string, config: ConfigField[], outputs: NodeDefinition["outputs"]): NodeDefinition => ({
    ...definition(type, "data", config),
    outputs,
  })

  it("lists the nodes that can feed an input, with the ports that fit", () => {
    const options = getCompatibleSourceOptions("number", [
      source("counter", [], [{ id: "count", name: "Count", dataType: "number" }]),
      // 值节点：唯一的输出就是它自己的参数
      source("text", [{ id: "value", name: "Value", dataType: "string", hasOutput: true }], []),
      source("file", [{ id: "file", name: "File", dataType: "bytes", hasOutput: true }], []),
      source("sink", [{ id: "input", name: "Input", dataType: "number", hasInput: true }], []),
    ])

    // 文件给不了数字，只有输入的节点没有可接出来的东西；类型一致的排在要转换的前面
    expect(options.map((option) => [option.definition.type, option.ports.map((port) => port.id)])).toEqual([
      ["counter", ["count"]],
      ["text", ["value"]],
    ])
  })

  it("offers a tool's result ahead of the settings it passes through", () => {
    const [encoder] = getCompatibleSourceOptions("string", [
      source(
        "encoding",
        [
          { id: "input", name: "Input", dataType: "string", hasInput: true },
          { id: "mode", name: "Mode", dataType: "string", hasInput: true, hasOutput: true },
        ],
        [{ id: "output", name: "Output", dataType: "string" }],
      ),
    ])

    expect(encoder.ports.map((port) => port.id)).toEqual(["output", "mode"])
    expect(encoder.defaultPortId).toBe("output")
  })

  it("defaults to the output whose type matches exactly", () => {
    const [parser] = getCompatibleSourceOptions("json", [
      source("parser", [], [
        { id: "text", name: "Text", dataType: "string" },
        { id: "parsed", name: "Parsed", dataType: "json" },
      ]),
    ])

    expect(parser.defaultPortId).toBe("parsed")
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
