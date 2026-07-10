import { describe, expect, it } from "vitest"
import { processMarkdown } from "./markdown-tools"

const MARKDOWN = "# Title\n\n## Section One\n\nHello **world**."

describe("Markdown tools", () => {
  it("renders GFM-compatible HTML", () => {
    expect(processMarkdown(MARKDOWN, "to-html")).toContain("<strong>world</strong>")
  })

  it("generates a nested table of contents", () => {
    expect(processMarkdown(MARKDOWN, "toc")).toBe("- [Title](#title)\n  - [Section One](#section-one)")
  })

  it("extracts readable plain text", () => {
    expect(processMarkdown("Hello **world**", "plain-text")).toBe("Hello world")
  })
})
