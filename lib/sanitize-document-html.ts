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
  // The client component is still pre-rendered by Next.js. The browser build of
  // DOMPurify exposes `sanitize`, while its server-side factory does not. Never
  // echo unsanitized markup during SSR; the browser recomputes the preview after
  // the user produces output.
  if (
    typeof window === "undefined" ||
    typeof DOMPurify.sanitize !== "function"
  ) {
    return ""
  }

  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ACTIVE_CONTENT_TAGS,
    FORBID_ATTR: ["style"],
    ALLOW_DATA_ATTR: false,
  })
}
