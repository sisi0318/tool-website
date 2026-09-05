import { describe, expect, it } from "vitest"
import { diffAdapter } from "./diff"

describe("structured diff adapter", () => {
  it("keeps the existing text output shape", async () => {
    expect(await diffAdapter.execute({ text1: "a", text2: "b" }, {})).toMatchObject({ added: 1, removed: 1, changed: 0, changes: [{ type: "remove", line: "a", lineNum: 1 }, { type: "add", line: "b", lineNum: 2 }] })
  })
  it("shares structured comparison and ignored paths with the page", async () => {
    const result = await diffAdapter.execute({ text1: '{"users":[{"id":1,"n":"a"},{"id":2,"n":"b"}],"time":1}', text2: '{"time":2,"users":[{"id":2,"n":"b"},{"id":1,"n":"new"}]}' }, { mode: "json", arrayKey: "id", ignorePaths: "time\n" })
    expect(result.changed).toBe(1)
    expect(result.changes).toEqual([{ type: "changed", path: "$.users[id=1].n", oldPath: "/users/0/n", newPath: "/users/1/n", oldValue: "a", newValue: "new" }])
  })
  it("supports YAML and reports invalid data instead of falling back to text", async () => {
    expect((await diffAdapter.execute({}, { text1: "a: 1", text2: "a: 2", mode: "yaml" })).changed).toBe(1)
    await expect(diffAdapter.execute({ text1: "{", text2: "{}" }, { mode: "json" })).rejects.toThrow(/invalidInput/)
  })
})
