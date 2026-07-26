import { beforeEach, describe, expect, it } from "vitest"

import { clearRegistry, registerNode } from "../canvas/registry"
import { registerBasicNodes } from "../adapters/basic"
import { registerEncodingAdapter } from "../adapters/encoding"
import { registerHashAdapter } from "../adapters/hash"
import { registerJsonFormatAdapter } from "../adapters/json-format"
import { registerJwtAdapter } from "../adapters/jwt"
import {
  appendNode,
  createJourney,
  getBranchPoints,
  getChildren,
  getPath,
  getPathSteps,
  inferDataType,
  removeSubtree,
} from "./tree"
import { applyStep, getMainInputPort, replaySteps, resolveOutputPort } from "./engine"
import { getCompatibleTools, suggestNext } from "./suggest"
import {
  decodeSharedPath,
  deleteDraft,
  encodeSharedPath,
  loadDraft,
  loadJourney,
  persistJourney,
  restoreJourney,
  sanitizeConfig,
  saveDraft,
  saveJourney,
} from "./serialize"
import { replaceNodeValue } from "./tree"
import { pathToWorkflow } from "./to-canvas"
import type { JourneyStep } from "./types"
import { getNodeDefinition } from "../canvas/registry"

const BASE64_DECODE: JourneyStep = {
  tool: "encoding",
  config: { encoding: "base64", mode: "decode" },
  outputPort: "output",
}

beforeEach(() => {
  clearRegistry()
  registerBasicNodes()
  registerEncodingAdapter()
  registerHashAdapter()
  registerJsonFormatAdapter()
  registerJwtAdapter()
  window.localStorage.clear()
})

describe("tree", () => {
  it("infers data types from values", () => {
    expect(inferDataType("text")).toBe("string")
    expect(inferDataType(42)).toBe("number")
    expect(inferDataType(true)).toBe("boolean")
    expect(inferDataType({ a: 1 })).toBe("json")
    expect(inferDataType(new File(["x"], "x.bin"))).toBe("bytes")
  })

  it("appends nodes and extracts the active path with steps", () => {
    const journey = createJourney("t", "aGVsbG8=", "输入")
    const first = appendNode(journey, journey.rootId, BASE64_DECODE, "hello", "Encoding")
    const second = appendNode(
      first.journey,
      first.nodeId,
      { tool: "hash", config: { algorithm: "md5" }, outputPort: "hash" },
      "5d41402abc4b2a76b9719d911017c592",
      "Hash",
    )

    const path = getPath(second.journey, second.nodeId)
    expect(path.map((node) => node.label)).toEqual(["输入", "Encoding", "Hash"])
    expect(getPathSteps(second.journey, second.nodeId).map((step) => step.tool)).toEqual([
      "encoding",
      "hash",
    ])
  })

  it("supports forking and reports branch points", () => {
    const journey = createJourney("t", "data", "输入")
    const a = appendNode(journey, journey.rootId, BASE64_DECODE, "a", "A")
    const b = appendNode(a.journey, journey.rootId, { ...BASE64_DECODE, config: {} }, "b", "B")

    expect(getChildren(b.journey, journey.rootId)).toHaveLength(2)
    expect(getBranchPoints(b.journey).has(journey.rootId)).toBe(true)
  })

  it("removes a subtree and retargets the active node", () => {
    const journey = createJourney("t", "data", "输入")
    const a = appendNode(journey, journey.rootId, BASE64_DECODE, "a", "A")
    const b = appendNode(a.journey, a.nodeId, BASE64_DECODE, "b", "B")

    const pruned = removeSubtree(b.journey, a.nodeId)
    expect(Object.keys(pruned.nodes)).toEqual([journey.rootId])
    expect(pruned.activeId).toBe(journey.rootId)
  })

  it("never removes the root", () => {
    const journey = createJourney("t", "data", "输入")
    expect(removeSubtree(journey, journey.rootId)).toBe(journey)
  })

  it("clears the valueMissing flag when a value is restored", () => {
    const journey = createJourney("t", "data", "输入")
    const withMissing = {
      ...journey,
      nodes: {
        [journey.rootId]: { ...journey.nodes[journey.rootId], valueMissing: true as const },
      },
    }
    const restored = replaceNodeValue(withMissing, journey.rootId, "recovered")
    expect(restored.nodes[journey.rootId].value).toBe("recovered")
    expect(restored.nodes[journey.rootId].valueMissing).toBeUndefined()
  })
})

describe("engine", () => {
  it("resolves the first hasInput field as the main port", () => {
    const encoding = getNodeDefinition("encoding")!
    expect(getMainInputPort(encoding)?.id).toBe("input")
  })

  it("falls back to hasOutput config fields when outputs are empty", () => {
    const stringDef = getNodeDefinition("string")!
    expect(resolveOutputPort(stringDef)).toBe("value")
  })

  it("applies a base64 decode step", async () => {
    const result = await applyStep("aGVsbG8=", BASE64_DECODE)
    expect(result.value).toBe("hello")
    expect(result.valueType).toBe("string")
  })

  it("rejects unknown tools", async () => {
    await expect(applyStep("x", { tool: "nope", config: {}, outputPort: "" })).rejects.toThrow(
      "Unknown tool",
    )
  })

  it("replays a chain and stops on the failing step", async () => {
    const replay = await replaySteps("aGVsbG8=", [
      BASE64_DECODE,
      { tool: "json-format", config: {}, outputPort: "formatted" },
    ])
    expect(replay.ok).toBe(false)
    expect(replay.outcomes[0].status).toBe("success")
    expect(replay.outcomes[1].status).toBe("error")
    expect(replay.finalValue).toBe("hello")
  })

  it("replays a full chain successfully", async () => {
    const replay = await replaySteps('{"a":1}', [
      { tool: "json-format", config: {}, outputPort: "formatted" },
    ])
    expect(replay.ok).toBe(true)
    expect(String(replay.finalValue)).toContain('"a"')
  })
})

describe("suggest", () => {
  it("ranks base64 decode first for base64 input", () => {
    const suggestions = suggestNext("aGVsbG8gd29ybGQ=", "string")
    expect(suggestions[0].tool).toBe("encoding")
    expect(suggestions[0].config).toMatchObject({ encoding: "base64", mode: "decode" })
    expect(suggestions[0].reason).toBe("detection")
  })

  it("suggests JWT decode with the payload port for tokens", () => {
    const token =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
    const suggestions = suggestNext(token, "string")
    const jwt = suggestions.find((s) => s.tool === "jwt")
    expect(jwt).toBeDefined()
    expect(jwt?.outputPort).toBe("payload")
  })

  it("silently drops curated entries whose tools are not registered", () => {
    clearRegistry()
    registerBasicNodes()
    // encoding/jwt 未注册:精选矩阵应全部降级,不抛错
    expect(() => suggestNext("aGVsbG8=", "string")).not.toThrow()
  })

  it("excludes basic and manual nodes from compatible tools", () => {
    registerNode({
      type: "manual-x",
      category: "dev",
      label: "Manual",
      executionMode: "manual",
      icon: (() => null) as never,
      config: [{ id: "input", name: "In", dataType: "string", hasInput: true }],
      outputs: [],
      execute: async () => ({}),
    })
    const tools = getCompatibleTools("string").map((definition) => definition.type)
    expect(tools).not.toContain("string")
    expect(tools).not.toContain("manual-x")
    expect(tools).toContain("encoding")
  })
})

describe("serialize", () => {
  it("round-trips a shared path through the URL hash", () => {
    const encoded = encodeSharedPath("我的旅程", [BASE64_DECODE], "aGVsbG8=")
    const decoded = decodeSharedPath(`#${encoded}`)
    expect(decoded?.name).toBe("我的旅程")
    expect(decoded?.steps).toEqual([BASE64_DECODE])
    expect(decoded?.rootText).toBe("aGVsbG8=")
  })

  it("omits oversized root text from shares", () => {
    const encoded = encodeSharedPath("t", [BASE64_DECODE], "x".repeat(5000))
    expect(decodeSharedPath(encoded)?.rootText).toBeUndefined()
  })

  it("rejects malformed hashes", () => {
    expect(decodeSharedPath("#j=!!!not-base64!!!")).toBeNull()
    expect(decodeSharedPath("")).toBeNull()
    expect(decodeSharedPath(`#j=${btoa('{"v":2}')}`)).toBeNull()
  })

  it("strips files from configs", () => {
    const config = sanitizeConfig({ keep: "a", file: new File(["x"], "x.bin"), fn: () => 1 })
    expect(config).toEqual({ keep: "a" })
  })

  it("persists journeys, degrading oversized and binary values", () => {
    const journey = createJourney("save-me", "root", "输入")
    const big = appendNode(journey, journey.rootId, BASE64_DECODE, "y".repeat(70 * 1024), "Big")
    const withFile = appendNode(
      big.journey,
      big.nodeId,
      BASE64_DECODE,
      new File(["x"], "x.bin"),
      "File",
    )

    const persisted = persistJourney(withFile.journey)
    expect(persisted.nodes[big.nodeId].valueMissing).toBe(true)
    expect(persisted.nodes[withFile.nodeId].valueMissing).toBe(true)
    expect(persisted.nodes[journey.rootId].value).toBe("root")

    const restored = restoreJourney(persisted)
    expect(restored.nodes[big.nodeId].value).toBeNull()

    expect(saveJourney(withFile.journey)).toBe(true)
    expect(loadJourney("save-me")?.rootId).toBe(journey.rootId)
    expect(loadJourney("missing")).toBeNull()
  })

  it("saves and deletes the draft", () => {
    const journey = createJourney("draft", "value", "输入")
    expect(saveDraft(journey)).toBe(true)
    expect(loadDraft()?.rootId).toBe(journey.rootId)
    expect(deleteDraft()).toBe(true)
    expect(loadDraft()).toBeNull()
  })
})

describe("to-canvas", () => {
  it("converts a text-rooted path into a chained workflow", () => {
    const journey = createJourney("t", "aGVsbG8=", "输入")
    const step = appendNode(journey, journey.rootId, BASE64_DECODE, "hello", "Encoding")
    const path = getPath(step.journey, step.nodeId)

    const { nodes, edges, skipped } = pathToWorkflow(path)
    expect(skipped).toEqual([])
    expect(nodes.map((node) => node.type)).toEqual(["string", "encoding"])
    expect(nodes[0].config).toEqual({ value: "aGVsbG8=" })
    expect(edges).toHaveLength(1)
    expect(edges[0]).toMatchObject({ sourcePort: "value", targetPort: "input" })
  })

  it("skips unregistered tools without breaking", () => {
    const journey = createJourney("t", "x", "输入")
    const step = appendNode(
      journey,
      journey.rootId,
      { tool: "ghost", config: {}, outputPort: "out" },
      "y",
      "Ghost",
    )
    const { nodes, edges, skipped } = pathToWorkflow(getPath(step.journey, step.nodeId))
    expect(skipped).toEqual(["ghost"])
    expect(nodes).toHaveLength(1)
    expect(edges).toHaveLength(0)
  })
})
