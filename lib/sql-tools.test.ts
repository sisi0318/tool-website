import { describe, expect, it } from "vitest"
import { formatSql, minifySql } from "./sql-tools"

describe("SQL tools", () => {
  it("formats SQL with the selected dialect", () => {
    const result = formatSql("select id,name from users where active=true", { language: "postgresql" })
    expect(result).toContain("SELECT")
    expect(result).toContain("\nFROM")
  })

  it("minifies whitespace and removes comments", () => {
    expect(minifySql("SELECT  id, name -- columns\n FROM users;"))
      .toBe("SELECT id,name FROM users;")
  })

  it("preserves whitespace and comment markers inside strings", () => {
    expect(minifySql("SELECT 'a  -- b', \"full name\" FROM t"))
      .toBe("SELECT 'a  -- b',\"full name\" FROM t")
  })

  it("does not merge operators into a comment token", () => {
    expect(minifySql("SELECT value - -1 FROM numbers")).toBe("SELECT value - -1 FROM numbers")
  })

  it("does not interpret adjacent subtraction operators as a comment", () => {
    expect(minifySql("SELECT a--b FROM numbers")).toBe("SELECT a--b FROM numbers")
  })

  it("uses backslash parity when finding the end of quoted values", () => {
    expect(
      minifySql(String.raw`SELECT 'it\'s -- text' FROM t -- remove
WHERE id = 1`),
    ).toBe(String.raw`SELECT 'it\'s -- text' FROM t WHERE id = 1`)

    expect(
      minifySql(String.raw`SELECT 'path\\' -- remove
FROM t`),
    ).toBe(String.raw`SELECT 'path\\' FROM t`)
  })
})
