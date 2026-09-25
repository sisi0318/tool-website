"use client"

import { useRef, type ChangeEvent, type DragEvent } from "react"
import { useToast } from "@/hooks/use-toast"
import { useTranslations } from "@/hooks/use-translations"
import { takeInputFiles } from "@/lib/file-input"
import { FILE_SIZE_LIMITS, formatFileSizeLimit } from "@/lib/file-limits"
import { readTextFile, TextFileError } from "@/lib/text-file"

/**
 * 给文本输入框加“打开文件”和拖入文件：按 BOM / 严格 UTF-8 读取、限制大小，
 * 读不了时用提示说明原因。onText 拿到的是去掉 BOM 的文本。
 *
 * 用法：按钮 onClick={open}，渲染 <input {...inputProps} />，文本框展开 dropProps。
 */
export function useTextFileInput({
  onText,
  accept,
  maxBytes = FILE_SIZE_LIMITS.textInput,
}: {
  onText: (text: string, file: File) => void
  accept?: string
  maxBytes?: number
}) {
  const { toast } = useToast()
  const t = useTranslations("common")
  const inputRef = useRef<HTMLInputElement>(null)

  const load = async (file: File) => {
    try {
      onText(await readTextFile(file, maxBytes), file)
    } catch (error) {
      const tooLarge = error instanceof TextFileError && error.code === "tooLarge"
      toast({
        variant: "destructive",
        title: t("openFileFailed"),
        description: tooLarge ? t("textFileTooLarge").replace("{size}", formatFileSizeLimit(maxBytes)) : t("notTextFile"),
      })
    }
  }

  return {
    open: () => inputRef.current?.click(),
    inputProps: {
      ref: inputRef,
      type: "file" as const,
      className: "hidden",
      tabIndex: -1,
      accept,
      onChange: (event: ChangeEvent<HTMLInputElement>) => {
        const [file] = takeInputFiles(event)
        if (file) void load(file)
      },
    },
    dropProps: {
      onDragOver: (event: DragEvent<HTMLElement>) => {
        if (Array.from(event.dataTransfer.types ?? []).includes("Files")) event.preventDefault()
      },
      onDrop: (event: DragEvent<HTMLElement>) => {
        const file = event.dataTransfer.files?.[0]
        if (!file) return
        event.preventDefault()
        void load(file)
      },
    },
  }
}
