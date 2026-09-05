import { describe, expect, it } from "vitest"
import { compareStructuredText, compareStructuredValues, parseStructuredData, StructuredDiffError } from "./structured-diff"

describe("structured diff", () => {
  it("ignores object key order while preserving scalar types and array order", () => {
    expect(compareStructuredValues({ a: 1, b: { c: true } }, { b: { c: true }, a: 1 }).equal).toBe(true)
    expect(compareStructuredValues({ a: 1 }, { a: "1" }).changes).toEqual([{ type: "changed", path: "$.a", oldPath: "/a", newPath: "/a", oldValue: 1, newValue: "1" }])
    expect(compareStructuredValues([1, 2], [2, 1]).changed).toBe(2)
  })

  it("reports leaf additions and removals, nulls and empty containers", () => {
    const result = compareStructuredValues({ old: null, a: [] }, { a: [], user: { name: "Ada" }, empty: {} })
    expect(result.changes).toEqual([
      { type: "removed", path: "$.old", oldPath: "/old", oldValue: null },
      { type: "added", path: "$.user.name", newPath: "/user/name", newValue: "Ada" },
      { type: "added", path: "$.empty", newPath: "/empty", newValue: {} },
    ])
    expect(compareStructuredValues(null, []).changes[0]).toMatchObject({ type: "changed", path: "$", oldValue: null, newValue: [] })
  })

  it("ignores dotted paths, wildcards and escaped JSON Pointers", () => {
    const left = { metadata: { updated: 1 }, users: [{ id: 1, lastSeen: 1 }], "a/b~": { version: 1 } }
    const right = { metadata: { updated: 2 }, users: [{ id: 1, lastSeen: 2 }], "a/b~": { version: 2 } }
    expect(compareStructuredValues(left, right, { ignorePaths: ["metadata.updated", "users.*.lastSeen", "/a~1b~0/version"] }).equal).toBe(true)
    expect(compareStructuredValues({}, { nested: { timestamp: "now" } }, { ignorePaths: ["**.timestamp"] }).equal).toBe(true)
  })

  it("omits ignored nested values from type-change reports", () => {
    const result = compareStructuredValues({ data: "before" }, { data: { id: 1, secret: 2 } }, { ignorePaths: ["**.secret"] })
    expect(result.changes[0].newValue).toEqual({ id: 1 })
  })

  it("aligns object arrays by typed keys and keeps original JSON Pointer locations", () => {
    const left = { users: [{ id: "a", name: "Ada" }, { id: "b", name: "Bob" }] }
    const right = { users: [{ id: "b", name: "Bob" }, { id: "a", name: "Ann" }] }
    expect(compareStructuredValues(left, right, { arrayKey: "id" }).changes).toEqual([{ type: "changed", path: '$.users[id="a"].name', oldPath: "/users/0/name", newPath: "/users/1/name", oldValue: "Ada", newValue: "Ann" }])
    expect(compareStructuredValues([{ id: 1 }, { id: "1" }], [{ id: "1" }, { id: 1 }], { arrayKey: "id" }).equal).toBe(true)
  })

  it("aligns added records and leaves primitive arrays positional", () => {
    expect(compareStructuredValues([], [{ id: "new", value: 1 }], { arrayKey: "id" }).added).toBe(2)
    expect(compareStructuredValues([1], [2], { arrayKey: "id" }).changed).toBe(1)
  })

  it("rejects missing or duplicated array keys without guessing a match", () => {
    expect(() => compareStructuredValues([{ id: "x" }, { id: "x" }], [], { arrayKey: "id" })).toThrow(/duplicateKey/)
    expect(() => compareStructuredValues([{ id: 1 }, {}], [], { arrayKey: "id" })).toThrow(/missingKey/)
  })

  it("compares prototype-like keys as ordinary data", async () => {
    const result = await compareStructuredText('{"__proto__":{"polluted":1},"constructor":1}', '{"__proto__":{"polluted":2},"constructor":2}', "json")
    expect(result.changed).toBe(2)
    expect({}).not.toHaveProperty("polluted")
  })

  it("parses YAML with aliases while keeping dates as strings", async () => {
    const value = await parseStructuredData('date: 2026-09-05\na: &item\n  id: 1\nb: *item\n', "yaml")
    expect(value).toEqual({ date: "2026-09-05", a: { id: 1 }, b: { id: 1 } })
    expect((await compareStructuredText("a: 1\nb: 2", "b: 2\na: 1", "yaml")).equal).toBe(true)
  })

  it.each(["&loop [*loop]", 'a: 1\na: 2', '!!js/function "function(){}"'])("rejects unsafe or invalid YAML %s", async (value) => {
    await expect(parseStructuredData(value, "yaml")).rejects.toThrow(StructuredDiffError)
  })

  it("identifies the failing input and rejects integers whose precision would be lost", async () => {
    await expect(compareStructuredText("{}", "{", "json")).rejects.toMatchObject({ code: "invalidInput", side: "right" })
    await expect(compareStructuredText('{"id":9007199254740993}', '{"id":9007199254740992}', "json")).rejects.toMatchObject({ code: "unsafeNumber", side: "left", path: "/id" })
    expect((await compareStructuredText('{"id":"9007199254740993"}', '{"id":"9007199254740992"}', "json")).changed).toBe(1)
  })

  it("bounds input, nesting, changes and ignore patterns", async () => {
    await expect(parseStructuredData(" ".repeat(2 * 1024 * 1024 + 1), "json")).rejects.toThrow(/inputLimit/)
    await expect(parseStructuredData(`${"[".repeat(82)}0${"]".repeat(82)}`, "json")).rejects.toThrow(/structureLimit/)
    expect(() => compareStructuredValues(Array(10_001).fill(0), Array(10_001).fill(1))).toThrow(/structureLimit/)
    expect(() => compareStructuredValues({}, {}, { ignorePaths: ["/bad~escape"] })).toThrow(/invalidIgnore/)
  })
})
