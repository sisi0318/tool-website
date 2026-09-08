import { describe, expect, it } from "vitest"
import { processCsv } from "./csv-tools"

describe("CSV tools", () => {
  it("can preserve identifiers, literal booleans and blank cells as text", () => {
    expect(JSON.parse(processCsv('id,flag,empty\n00123,true,\n12345678901234567890,false,', "to-json", { dynamicTyping: false }).output)).toEqual([{ id: "00123", flag: "true", empty: "" }, { id: "12345678901234567890", flag: "false", empty: "" }])
  })
  it("detects delimiter and converts CSV to JSON", () => {
    const result = processCsv("name;age\nAda;36\nLinus;54", "to-json")
    expect(result.delimiter).toBe(";")
    expect(JSON.parse(result.output)).toEqual([
      { name: "Ada", age: 36 },
      { name: "Linus", age: 54 },
    ])
  })

  it("ignores delimiters inside quoted fields when auto-detecting", () => {
    const result = processCsv('name;note\nAda;"uses, commas, inside"', "to-json")
    expect(result.delimiter).toBe(";")
    expect(JSON.parse(result.output)).toEqual([{ name: "Ada", note: "uses, commas, inside" }])
  })

  it("converts JSON to CSV", () => {
    const result = processCsv('[{"name":"Ada","active":true}]', "from-json")
    expect(result.output).toContain("name,active")
    expect(result.output).toContain("Ada,true")
  })

  it("preserves fields first appearing in later JSON objects in encounter order", () => {
    const result = processCsv('[{"name":"Ada"},{"name":"Bob","role":"admin"},{"id":"001","role":"user"}]', "from-json")
    expect(result.columns).toEqual(["name", "role", "id"])
    expect(result.output).toBe("name,role,id\r\nAda,,\r\nBob,admin,\r\n,user,001")
    expect(JSON.parse(processCsv(result.output, "to-json", { dynamicTyping: false }).output)).toEqual([
      { name: "Ada", role: "", id: "" }, { name: "Bob", role: "admin", id: "" }, { name: "", role: "user", id: "001" },
    ])
    expect(processCsv('[{}, {"later":"value"}]', "from-json", { header: false }).output).toBe("\r\nvalue")
  })

  it("rejects mixed JSON row shapes instead of dropping object fields", () => {
    expect(() => processCsv('[{"name":"Ada"},["Bob"]]', "from-json")).toThrow("all be objects or all be arrays")
  })

  it("converts delimited input to TSV", () => {
    expect(processCsv("a,b\n1,2", "to-tsv").output).toContain("a\tb")
  })
})
