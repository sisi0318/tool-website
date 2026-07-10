import { describe, expect, it } from "vitest"
import { processCsv } from "./csv-tools"

describe("CSV tools", () => {
  it("detects delimiter and converts CSV to JSON", () => {
    const result = processCsv("name;age\nAda;36\nLinus;54", "to-json")
    expect(result.delimiter).toBe(";")
    expect(JSON.parse(result.output)).toEqual([
      { name: "Ada", age: 36 },
      { name: "Linus", age: 54 },
    ])
  })

  it("converts JSON to CSV", () => {
    const result = processCsv('[{"name":"Ada","active":true}]', "from-json")
    expect(result.output).toContain("name,active")
    expect(result.output).toContain("Ada,true")
  })

  it("converts delimited input to TSV", () => {
    expect(processCsv("a,b\n1,2", "to-tsv").output).toContain("a\tb")
  })
})
