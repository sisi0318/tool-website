import DOMPurify from "dompurify"

const ACTIVE_CONTENT_TAGS = [
  "button",
  "embed",
  "form",
  "iframe",
  "input",
  "link",
  "meta",
  "object",
  "option",
  "select",
  "style",
  "textarea",
]

export function sanitizeDocumentHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ACTIVE_CONTENT_TAGS,
    FORBID_ATTR: ["style"],
    ALLOW_DATA_ATTR: false,
  })
}
