function legacyCopyText(text: string): boolean {
  if (typeof document === "undefined") return false

  const textarea = document.createElement("textarea")
  textarea.value = text
  textarea.setAttribute("readonly", "")
  textarea.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0;pointer-events:none"
  document.body.appendChild(textarea)
  textarea.select()

  try {
    return document.execCommand("copy")
  } finally {
    textarea.remove()
  }
}

async function writeText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Fall back for denied permissions, non-secure contexts, and embedded browsers.
  }

  try {
    return legacyCopyText(text)
  } catch {
    return false
  }
}

/**
 * 复制失败时在 window 上派发的事件，由根布局里的 ClipboardFailureNotifier 统一提示。
 * 以前不少工具复制失败时什么都不显示，用户以为已经复制，粘出去的却是旧内容。
 */
export const CLIPBOARD_FAILURE_EVENT = "tool-website:clipboard-failure"

export interface CopyTextOptions {
  /** 调用方自己已经展示失败（toast、行内报错）时传 false，避免同一次失败提示两遍 */
  reportFailure?: boolean
}

export async function copyTextToClipboard(text: string, options: CopyTextOptions = {}): Promise<boolean> {
  const copied = await writeText(text)
  if (!copied && options.reportFailure !== false && typeof window !== "undefined") {
    window.dispatchEvent(new Event(CLIPBOARD_FAILURE_EVENT))
  }
  return copied
}
