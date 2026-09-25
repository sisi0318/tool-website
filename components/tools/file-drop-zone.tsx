"use client"

import { useRef, useState, type DragEvent, type ReactNode } from "react"
import { Upload } from "lucide-react"
import { useTranslations } from "@/hooks/use-translations"
import { takeInputFiles } from "@/lib/file-input"
import { formatFileSizeLimit } from "@/lib/file-limits"
import { cn } from "@/lib/utils"

export interface SkippedFile {
  name: string
  reason: "type" | "size"
}

/** 与 <input accept> 相同的规则：".png" 按扩展名、"image/*" 按大类、"image/png" 按完整类型 */
export function matchesAccept(file: Pick<File, "name" | "type">, accept?: string): boolean {
  const tokens = (accept ?? "").split(",").map((token) => token.trim().toLowerCase()).filter(Boolean)
  if (!tokens.length) return true
  const name = file.name.toLowerCase()
  const type = file.type.toLowerCase()
  return tokens.some((token) => token.startsWith(".") ? name.endsWith(token) : token.endsWith("/*") ? type.startsWith(token.slice(0, -1)) : type === token)
}

export function splitAcceptedFiles(files: File[], { accept, maxBytes }: { accept?: string; maxBytes?: number }) {
  const accepted: File[] = []
  const skipped: SkippedFile[] = []
  for (const file of files) {
    if (!matchesAccept(file, accept)) skipped.push({ name: file.name, reason: "type" })
    else if (maxBytes !== undefined && file.size > maxBytes) skipped.push({ name: file.name, reason: "size" })
    else accepted.push(file)
  }
  return { accepted, skipped }
}

function carriesFiles(event: DragEvent<HTMLElement>) {
  return Array.from(event.dataTransfer?.types ?? []).includes("Files")
}

interface FileDropZoneProps {
  onFiles: (files: File[]) => void
  /** 空状态的提示文字，也是按钮的名称 */
  title: ReactNode
  hint?: ReactNode
  icon?: ReactNode
  /** 同时用于选择框和拖入的过滤 */
  accept?: string
  multiple?: boolean
  maxBytes?: number
  disabled?: boolean
  className?: string
  /** 已有文件时显示的内容（文件信息、进度等）。这块区域仍可拖入新文件替换，browse 打开选择框 */
  children?: (browse: () => void) => ReactNode
}

/**
 * 统一的文件拖放区：拖入高亮、键盘可用、按类型和大小过滤并列出被跳过的文件、
 * 选完重置 input（同一个文件能再选），选了文件以后仍能拖入新文件替换。
 */
export function FileDropZone({ onFiles, title, hint, icon, accept, multiple = false, maxBytes, disabled = false, className, children }: FileDropZoneProps) {
  const t = useTranslations("common")
  const inputRef = useRef<HTMLInputElement>(null)
  const depth = useRef(0)
  const [dragging, setDragging] = useState(false)
  const [skipped, setSkipped] = useState<SkippedFile[]>([])

  const browse = () => {
    if (!disabled) inputRef.current?.click()
  }

  const receive = (files: File[]) => {
    if (disabled || !files.length) return
    const split = splitAcceptedFiles(files, { accept, maxBytes })
    setSkipped(split.skipped)
    const accepted = multiple ? split.accepted : split.accepted.slice(0, 1)
    if (accepted.length) onFiles(accepted)
  }

  const onDragEnter = (event: DragEvent<HTMLDivElement>) => {
    if (!carriesFiles(event)) return
    event.preventDefault()
    depth.current += 1
    setDragging(true)
  }
  const onDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!carriesFiles(event)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = disabled ? "none" : "copy"
  }
  const onDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (!carriesFiles(event)) return
    depth.current = Math.max(0, depth.current - 1)
    if (!depth.current) setDragging(false)
  }
  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    depth.current = 0
    setDragging(false)
    receive(Array.from(event.dataTransfer?.files ?? []))
  }

  const reasonText = (item: SkippedFile) => item.reason === "type" ? t("skippedType") : t("skippedSize").replace("{size}", formatFileSizeLimit(maxBytes ?? 0))

  return (
    <div
      className={cn("rounded-[var(--md-sys-shape-corner-large)] transition-colors", dragging && !disabled && "bg-[var(--md-sys-color-primary-container)]/45 ring-2 ring-[var(--md-sys-color-primary)]", className)}
      data-dragging={dragging || undefined}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <input ref={inputRef} type="file" className="hidden" tabIndex={-1} accept={accept} multiple={multiple} disabled={disabled} onChange={(event) => receive(takeInputFiles(event))} />
      {children ? children(browse) : (
        <button
          type="button"
          disabled={disabled}
          onClick={browse}
          className="w-full rounded-[inherit] border-2 border-dashed border-[var(--md-sys-color-outline)] bg-[var(--md-sys-color-surface-container-low)] p-7 text-center transition-colors hover:border-[var(--md-sys-color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--md-sys-color-primary)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {icon ?? <Upload className="mx-auto mb-3 h-10 w-10 text-[var(--md-sys-color-on-surface-variant)]" aria-hidden="true" />}
          <span className="block font-medium">{title}</span>
          {hint && <span className="mt-2 block text-xs text-[var(--md-sys-color-on-surface-variant)]">{hint}</span>}
        </button>
      )}
      {skipped.length > 0 && (
        <div role="status" className="mt-2 rounded-xl bg-[var(--md-sys-color-surface-container)] p-3 text-xs text-[var(--md-sys-color-on-surface-variant)]">
          <p className="font-medium text-[var(--md-sys-color-on-surface)]">{t("filesSkipped").replace("{count}", String(skipped.length))}</p>
          <ul className="mt-1 space-y-0.5">
            {skipped.slice(0, 5).map((item, index) => (
              <li key={`${item.name}-${index}`}><span className="break-all font-mono">{item.name}</span> · {reasonText(item)}</li>
            ))}
            {skipped.length > 5 && <li>…</li>}
          </ul>
        </div>
      )}
    </div>
  )
}
