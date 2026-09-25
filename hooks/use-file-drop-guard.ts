"use client"

import { useEffect } from "react"

function carriesFiles(event: DragEvent): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes("Files")
}

/**
 * 文件没拖进任何投放区就松手时，浏览器默认会打开这个文件并离开本站，
 * 工作台里所有标签的输入和已载入的文件随之丢失。
 *
 * 各工具的投放区在 React 里先处理事件并 preventDefault；这里挂在 window 上，
 * 只兜底剩下没人接的文件拖放，并把光标显示成"不可放置"。拖动文字不受影响。
 */
export function useFileDropGuard(): void {
  useEffect(() => {
    const onDragOver = (event: DragEvent) => {
      if (event.defaultPrevented || !carriesFiles(event)) return
      event.preventDefault()
      if (event.dataTransfer) event.dataTransfer.dropEffect = "none"
    }
    const onDrop = (event: DragEvent) => {
      if (event.defaultPrevented || !carriesFiles(event)) return
      event.preventDefault()
    }

    window.addEventListener("dragover", onDragOver)
    window.addEventListener("drop", onDrop)
    return () => {
      window.removeEventListener("dragover", onDragOver)
      window.removeEventListener("drop", onDrop)
    }
  }, [])
}
