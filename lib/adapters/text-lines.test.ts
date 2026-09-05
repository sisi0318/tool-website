import { describe, expect, it } from "vitest"
import { textLinesAdapter } from "./text-lines"

describe("text lines adapter", () => {
  it("accepts both connected inputs for ordered set operations", async () => {
    expect(await textLinesAdapter.execute({ input: "a\nb\na", other: "b\nc" }, { operation: "union" })).toEqual({ output: "a\nb\nc", lines: ["a", "b", "c"], count: 3 })
  })
  it("uses exact numeric sorting and literal tab column settings", async () => {
    expect((await textLinesAdapter.execute({ input: "9007199254740993\n9007199254740992" }, { operation: "sort", sortMode: "numeric" })).output).toBe("9007199254740992\n9007199254740993")
    expect((await textLinesAdapter.execute({ input: "a\tb\tc" }, { operation: "columns", delimiter: "\\t", outputDelimiter: "|", columns: "3,1" })).output).toBe("c|a")
  })
})
