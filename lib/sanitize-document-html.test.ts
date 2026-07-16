import { describe, expect, it } from "vitest"

import { sanitizeDocumentHtml } from "./sanitize-document-html"

describe("sanitizeDocumentHtml", () => {
  it("removes executable content while keeping document markup", () => {
    const sanitized = sanitizeDocumentHtml(`
      <table><tr><td onclick="alert(1)">safe</td></tr></table>
      <img src="x" onerror="alert(2)">
      <a href="javascript:alert(3)">link</a>
      <script>alert(4)</script>
      <iframe srcdoc="<script>alert(5)</script>"></iframe>
    `)

    expect(sanitized).toContain("<table>")
    expect(sanitized).toContain("safe")
    expect(sanitized).not.toMatch(/onclick|onerror|javascript:|script|iframe/i)
  })

  it("removes active form controls and inline styles", () => {
    const sanitized = sanitizeDocumentHtml(
      '<form><input value="secret"></form><p style="background:url(https://example.test)">text</p>',
    )

    expect(sanitized).not.toMatch(/form|input|style=/i)
    expect(sanitized).toContain("<p>text</p>")
  })
})
