import { afterEach, describe, expect, it, vi } from "vitest"
import { clearAppCaches, readAppCacheUsage } from "./cache-storage"
afterEach(() => vi.unstubAllGlobals())
describe("application cache clearing", () => {
  function fake() {
    const names = new Set(["cross-origin", "apis", "ocr-public-models", "workbox-precache-v2-http://local/", "another-app-cache"])
    vi.stubGlobal("caches", { keys: async () => [...names], open: async () => ({ keys: async () => [new Request("https://example.test/")] }), delete: async (name: string) => names.delete(name) })
    return names
  }
  it("lists owned caches including legacy query data", async () => {
    fake(); const result = await readAppCacheUsage()
    expect(result).toHaveLength(4); expect(result.find(item => item.name === "cross-origin")).toMatchObject({ queryData: true, entries: 1 }); expect(result.some(item => item.name === "another-app-cache")).toBe(false)
  })
  it("clears legacy queries separately, and all owned resources without touching unrelated caches", async () => {
    const names = fake(); expect(await clearAppCaches(true)).toBe(2); expect(names.has("ocr-public-models")).toBe(true); expect(await clearAppCaches()).toBe(2); expect([...names]).toEqual(["another-app-cache"])
  })
  it("surfaces storage failures rather than reporting success", async () => {
    vi.stubGlobal("caches", { keys: async () => ["cross-origin"], delete: async () => { throw new Error("blocked") } }); await expect(clearAppCaches()).rejects.toThrow("blocked")
  })
})
