import { describe, expect, it } from "vitest"
import { expandJsonTreeToDepth, indexJsonTree, visibleJsonTreeEntries } from "./json-tree"
import { jsonPathAdapter, parseJsonPath } from "./adapters/json-path"

describe("JSON tree indexing", () => {
  it("keeps colliding-looking keys distinct and emits usable JSONPath expressions", async () => {
    const data = { "a.b": { "x/y~z": [null, false] }, a: { b: 0 }, "": "empty", 'quote"key': 42, "back\\slash": 7, "line\nbreak": 8, "right]bracket": 9 }
    const index = indexJsonTree(data)
    expect(index.byId.get("/a.b/x~1y~0z/0")?.value).toBeNull()
    expect(index.byId.get("/a/b")?.value).toBe(0)
    expect(index.byId.get("/")?.value).toBe("empty")
    expect(index.byId.get('/quote"key')?.path).toBe('$["quote\\"key"]')
    for (const entry of index.entries) {
      const result = await jsonPathAdapter.execute({ json: data, path: entry.path }, {})
      expect(result.type).toBe(entry.type)
      expect(result.string).toBe(typeof entry.value === "string" ? entry.value : JSON.stringify(entry.value))
    }
  })
  it("also accepts escaped single-quoted JSONPath keys", () => {
    expect(parseJsonPath("$['it\\'s']")).toEqual([{ key: "it's", isIndex: false }])
    expect(parseJsonPath("$['\\u4e2d']")).toEqual([{ key: "中", isIndex: false }])
    expect(() => parseJsonPath("$['bad\\q']")).toThrow(/Invalid escape/)
  })
  it("expands by relative depth and keeps descendants out of collapsed branches", () => {
    const index = indexJsonTree({ a: { b: { c: 1 } }, other: 2 })
    const expanded = expandJsonTreeToDepth(index, 2)
    expect(visibleJsonTreeEntries(index, expanded).entries.map((entry) => entry.id)).toEqual(["", "/a", "/a/b", "/other"])
    expect(visibleJsonTreeEntries(index, expandJsonTreeToDepth(index, 2, "/a"), "/a").entries.map((entry) => entry.id)).toEqual(["/a", "/a/b", "/a/b/c"])
    expect(visibleJsonTreeEntries(index, new Set()).entries).toHaveLength(1)
  })
  it("finds deep values with their ancestors and includes the contents of matching keys", () => {
    const index = indexJsonTree({ users: [{ name: "Ada" }, { name: "Bob" }], other: "hidden" })
    const result = visibleJsonTreeEntries(index, new Set(), "", "ada")
    expect(result.entries.map((entry) => entry.id)).toEqual(["", "/users", "/users/0", "/users/0/name"])
    expect([...result.matches]).toEqual(["/users/0/name"])
    const containerMatch = visibleJsonTreeEntries(index, new Set(), "", "users")
    expect(containerMatch.entries.map((entry) => entry.id)).toContain("/users/1/name")
    expect(containerMatch.entries.map((entry) => entry.id)).not.toContain("/other")
    expect(visibleJsonTreeEntries(index, new Set(), "/users/1", "Ada").matches.size).toBe(0)
  })
  it("bounds wide and deeply nested input without discarding values used by copy/export", () => {
    const value = Array.from({ length: 1000 }, (_, index) => index)
    const indexed = indexJsonTree(value, 100)
    expect(indexed.entries).toHaveLength(100)
    expect(indexed.limited).toBe(true)
    expect(indexed.entries[0].value).toBe(value)
    const deep = JSON.parse("[".repeat(200) + "1" + "]".repeat(200))
    const result = indexJsonTree(deep)
    expect(result.entries).toHaveLength(129)
    expect(result.limited).toBe(true)
  })
})
