import { marked, type Token } from "marked"

export type MarkdownOperation = "to-html" | "toc" | "plain-text"

export function markdownToHtml(input: string): string {
  return marked.parse(input, { async: false, gfm: true, breaks: false }) as string
}

function walkHeadings(tokens: Token[], headings: Array<{ depth: number; text: string }>) {
  for (const token of tokens) {
    if (token.type === "heading") headings.push({ depth: token.depth, text: token.text })
    const nested = "tokens" in token ? token.tokens : undefined
    if (Array.isArray(nested)) walkHeadings(nested, headings)
  }
}

function slugify(value: string): string {
  return value.toLowerCase().trim().replace(/[^\p{L}\p{N}\s-]/gu, "").replace(/\s+/g, "-")
}

export function markdownTableOfContents(input: string): string {
  const headings: Array<{ depth: number; text: string }> = []
  walkHeadings(marked.lexer(input), headings)
  return headings.map((heading) => `${"  ".repeat(Math.max(0, heading.depth - 1))}- [${heading.text}](#${slugify(heading.text)})`).join("\n")
}

export function markdownToPlainText(input: string): string {
  return markdownToHtml(input)
    .replace(/<pre><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
}

export function processMarkdown(input: string, operation: MarkdownOperation): string {
  if (operation === "toc") return markdownTableOfContents(input)
  if (operation === "plain-text") return markdownToPlainText(input)
  return markdownToHtml(input)
}

