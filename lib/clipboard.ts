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

export type ClipboardFailureKind = "text" | "image"

function reportFailure(kind: ClipboardFailureKind, options: CopyTextOptions): void {
  if (options.reportFailure === false || typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent<ClipboardFailureKind>(CLIPBOARD_FAILURE_EVENT, { detail: kind }))
}

export async function copyTextToClipboard(text: string, options: CopyTextOptions = {}): Promise<boolean> {
  const copied = await writeText(text)
  if (!copied) reportFailure("text", options)
  return copied
}

/** 浏览器能否把图片写进剪贴板（Firefox 127 之前没有 ClipboardItem） */
export function canCopyImages(): boolean {
  return typeof ClipboardItem !== "undefined" && typeof navigator !== "undefined" && typeof navigator.clipboard?.write === "function"
}

async function toPngBlob(blob: Blob): Promise<Blob> {
  if (blob.type === "image/png") return blob
  const bitmap = await createImageBitmap(blob)
  try {
    const canvas = document.createElement("canvas")
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0)
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((png) => (png ? resolve(png) : reject(new Error("PNG encoding failed"))), "image/png")
    })
  } finally {
    bitmap.close()
  }
}

/**
 * 把图片写进剪贴板，可以直接粘贴进聊天和文档。剪贴板普遍只接受 PNG，其它格式先转换。
 * 可以传 Promise：Safari 要求在点击事件的同步调用栈里创建 ClipboardItem，
 * 图片还在生成时先把 Promise 交给它，而不是 await 之后再创建。
 */
export async function copyImageToClipboard(image: Blob | Promise<Blob>, options: CopyTextOptions = {}): Promise<boolean> {
  let copied = false
  if (canCopyImages()) {
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": Promise.resolve(image).then(toPngBlob) })])
      copied = true
    } catch {
      copied = false
    }
  }
  if (!copied) reportFailure("image", options)
  return copied
}
