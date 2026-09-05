import { describe, expect, it } from "vitest"
import { processTextLines, splitTextLines, TEXT_LINE_LIMITS } from "./text-line-tools"

describe("text line tools", () => {
  it("treats a final terminator separately from an extra blank line", () => {
    expect(splitTextLines("a\r\nb\rc\n")).toEqual(["a", "b", "c"])
    expect(splitTextLines("a\n\n")).toEqual(["a", ""])
    expect(splitTextLines("")).toEqual([]); expect(splitTextLines("\n")).toEqual([""])
  })
  it("cleans whitespace and preserves requested line endings", () => {
    expect(processTextLines(" a \r\n \n b\r\n", { operation: "clean", trim: true, newline: "crlf", trailingNewline: true })).toMatchObject({ output: "a\r\nb\r\n", inputLines: 3, emptyRemoved: 1 })
    expect(processTextLines(" \n\n", { operation: "clean", removeEmpty: false }).lines).toEqual([" ", ""])
  })
  it("deduplicates by optional lowercase keys while retaining the first spelling and order", () => {
    expect(processTextLines(" A\na\nB\nb\nA", { trim: true, ignoreCase: true })).toMatchObject({ output: "A\nB", duplicatesRemoved: 3 })
    expect(processTextLines("A\na", {}).lines).toEqual(["A", "a"])
  })
  it("performs ordered set operations without duplicate lines", () => {
    const options = { other: "b\nC\nD\nD", ignoreCase: true }
    expect(processTextLines("A\nB\nA\nC", { ...options, operation: "union" }).lines).toEqual(["A", "B", "C", "D"])
    expect(processTextLines("A\nB\nA\nC", { ...options, operation: "intersection" }).lines).toEqual(["B", "C"])
    expect(processTextLines("A\nB\nA\nC", { ...options, operation: "difference" }).lines).toEqual(["A"])
    expect(processTextLines("A\nB\nA\nC", { ...options, operation: "symmetric-difference" }).lines).toEqual(["A", "D"])
  })
  it("sorts naturally and preserves order for equal keys", () => {
    expect(processTextLines("x10\nx2\nx1", { operation: "sort", sortMode: "natural" }).output).toBe("x1\nx2\nx10")
    expect(processTextLines("b\nA\na", { operation: "sort", ignoreCase: true, descending: true }).lines).toEqual(["b", "A", "a"])
  })
  it("sorts decimal and scientific numbers exactly without floating-point rounding", () => {
    const values = ["9007199254740993", "9007199254740992", "1.00000000000000000002", "1.00000000000000000001", "-0", "0", "-.2", "1e-10000", "-1e10000", "1e10000", "10", "1e1"]
    const result = processTextLines(values.join("\n"), { operation: "sort", sortMode: "numeric" })
    expect(result.lines).toEqual(["-1e10000", "-.2", "-0", "0", "1e-10000", "1.00000000000000000001", "1.00000000000000000002", "10", "1e1", "9007199254740992", "9007199254740993", "1e10000"])
    expect(() => processTextLines("\n2\nbad", { operation: "sort", sortMode: "numeric" })).toThrow("invalidNumber: 3")
  })
  it("adds literal prefixes and suffixes, including blank lines when requested", () => {
    expect(processTextLines("a\n\nb", { operation: "affix", prefix: "[", suffix: "]", removeEmpty: false }).output).toBe("[a]\n[]\n[b]")
    expect(() => processTextLines("a", { operation: "affix", prefix: "x\n" })).toThrow("invalidOption")
  })
  it("extracts and reorders literal-delimited columns and reports source lines", () => {
    expect(processTextLines("a::b::c\nx::y", { operation: "columns", delimiter: "::", columns: "3,1-2,1", outputDelimiter: "|" }).output).toBe("c|a|b|a\n|x|y|x")
    expect(processTextLines("  a   b\tc ", { operation: "columns", whitespaceDelimiter: true, columns: "2-3", outputDelimiter: "," }).output).toBe("b,c")
    expect(() => processTextLines("a,b\n\nx", { operation: "columns", delimiter: ",", columns: "2", missingColumn: "error" })).toThrow("missingColumn: 3")
    expect(() => processTextLines("a", { operation: "columns", columns: "0" })).toThrow("invalidColumn")
    expect(() => processTextLines("a", { operation: "columns", columns: "2-1" })).toThrow("invalidColumn")
  })
  it("bounds expanded affixes and repeated column output before concatenation", () => {
    expect(() => processTextLines("x\n".repeat(100), { operation: "affix", prefix: "a".repeat(200000) })).toThrow("outputLimit")
    expect(() => processTextLines("x".repeat(20000), { operation: "columns", columns: Array(1000).fill("1").join(",") })).toThrow("outputLimit")
    expect(() => processTextLines("x".repeat(TEXT_LINE_LIMITS.inputChars + 1))).toThrow("inputLimit")
  })
})
