"use client"

import { useEffect, useRef } from "react"
import { useToolActivity } from "@/components/tool-activity"

const NON_TEXT_INPUTS = new Set(["button", "checkbox", "color", "file", "hidden", "image", "radio", "range", "reset", "submit"])

function isEditable(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  if (target instanceof HTMLTextAreaElement) return !target.readOnly && !target.disabled
  if (target instanceof HTMLInputElement) return !target.readOnly && !target.disabled && !NON_TEXT_INPUTS.has(target.type)
  return false
}

/** 这次粘贴里要交给工具的文件；焦点在文本框里且剪贴板带文字时，按普通文字粘贴处理 */
export function pastedFiles(event: ClipboardEvent): File[] {
  const data = event.clipboardData
  if (!data) return []
  if (isEditable(event.target) && Array.from(data.types ?? []).includes("text/plain")) return []
  const files = Array.from(data.files ?? [])
  if (files.length) return files
  return Array.from(data.items ?? [])
    .filter((item) => item.kind === "file")
    .map((item) => item.getAsFile())
    .filter((file): file is File => file !== null)
}

/** 单图工具用：剪贴板里有多个文件时优先取图片，都不是图片就交出第一个，由工具提示格式不对 */
export function preferImage(files: File[]): File {
  return files.find((file) => file.type.startsWith("image/")) ?? files[0]
}

/**
 * 在整个页面接收粘贴的文件（截图、复制的图片）。以前只挂在个别区域的 onPaste 上，
 * 页面刚打开或焦点在按钮上时按 Ctrl+V 没有反应。
 *
 * 工作台里隐藏的标签、页内未选中的面板都常驻挂载，所以只在 useToolActivity() 为真时接收，
 * 否则每个打开的图片工具都会收到同一次粘贴。有多个面板的页面要给每个面板套一层
 * PanelActivityProvider。剪贴板里没有文件时不拦截；文件类型和大小由工具自己校验并提示。
 */
export function usePasteFiles(onFiles: (files: File[]) => void, enabled = true) {
  const active = useToolActivity()
  const onFilesRef = useRef(onFiles)
  useEffect(() => {
    onFilesRef.current = onFiles
  })

  useEffect(() => {
    if (!active || !enabled) return
    const handlePaste = (event: ClipboardEvent) => {
      if (event.defaultPrevented) return
      const files = pastedFiles(event)
      if (!files.length) return
      event.preventDefault()
      onFilesRef.current(files)
    }
    document.addEventListener("paste", handlePaste)
    return () => document.removeEventListener("paste", handlePaste)
  }, [active, enabled])
}
