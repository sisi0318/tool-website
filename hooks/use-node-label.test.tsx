import { renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { useNodeLabel } from "./use-node-label"

describe("useNodeLabel", () => {
  it("shows the node name in the interface language and falls back to the English label", () => {
    const { result } = renderHook(() => useNodeLabel())
    expect(result.current({ type: "hash", label: "Hash" })).toBe("哈希计算")
    expect(result.current({ type: "json-format", label: "JSON Format" })).toBe("JSON 格式化")
    expect(result.current({ type: "not-registered", label: "Custom Node" })).toBe("Custom Node")
  })
})
