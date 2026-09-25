import type { ChangeEvent } from "react"

/**
 * 取出 file input 选中的文件，同时清空它的值。
 * 不清空的话，再选同一个文件（比如改完原文件后重新载入）不会触发 change。
 */
export function takeInputFiles(event: ChangeEvent<HTMLInputElement>): File[] {
  const files = Array.from(event.target.files ?? [])
  event.target.value = ""
  return files
}
