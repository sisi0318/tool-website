import { describe, expect, it } from "vitest"
import { registerAllAdapters } from "@/lib/adapters"
import { getAllNodes } from "@/lib/canvas/registry"
import { en } from "@/lib/translations/en"
import { zhNodes } from "@/lib/translations/zh-namespaces/nodes"

registerAllAdapters()

describe("node names", () => {
  it("gives every registered node a name in both languages and keeps no stale ones", () => {
    const types = getAllNodes().map((node) => node.type).sort()
    for (const dictionary of [{ nodes: zhNodes }, en]) {
      const names = (dictionary as unknown as { nodes: Record<string, string> }).nodes
      expect(Object.keys(names).sort()).toEqual(types)
      for (const type of types) expect(names[type].trim()).not.toBe("")
    }
  })
})
