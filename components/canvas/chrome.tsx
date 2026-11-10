"use client"

import type { ComponentProps } from "react"

/** 浮在画布上的工具条和卡片共用的底：半透明表面、描边、阴影 */
export const FLOATING_SURFACE =
  "rounded-[var(--md-sys-shape-corner-large)] border border-md-outline-variant bg-md-surface-container shadow-lg"

const IS_APPLE =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.platform)

/** "mod+shift+z" 写成当前系统的样子：Ctrl+Shift+Z 或 ⌘⇧Z */
export function formatShortcut(keys: string): string {
  const parts = keys.split("+").map((key) => {
    if (key === "mod") return IS_APPLE ? "⌘" : "Ctrl"
    if (key === "shift") return IS_APPLE ? "⇧" : "Shift"
    return key.length === 1 ? key.toUpperCase() : key[0].toUpperCase() + key.slice(1)
  })
  return parts.join(IS_APPLE ? "" : "+")
}

interface ChromeButtonProps extends Omit<ComponentProps<"button">, "aria-label" | "title" | "type"> {
  /** 读屏名称，也是悬停提示 */
  label: string
  /** 只写进悬停提示，例如 formatShortcut("mod+z") */
  shortcut?: string
  /** 开关按钮的状态；不传就是普通按钮 */
  active?: boolean
  tone?: "default" | "primary" | "tonal" | "danger"
}

/** 浮动工具条里的按钮：手机上 44px，桌面上 36px */
export function ChromeButton({
  label,
  shortcut,
  active,
  tone = "default",
  className = "",
  children,
  ...rest
}: ChromeButtonProps) {
  const toneClass =
    tone === "primary"
      ? "bg-md-primary text-md-on-primary hover:opacity-90"
      : active || tone === "tonal"
        ? "bg-md-secondary-container text-md-on-secondary-container hover:opacity-90"
        : tone === "danger"
          ? "text-md-on-surface-variant hover:bg-md-error-container hover:text-md-on-error-container"
          : "text-md-on-surface-variant hover:bg-md-hover hover:text-md-on-surface"

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={rest["aria-expanded"] === undefined ? active : undefined}
      title={shortcut ? `${label} (${shortcut})` : label}
      className={`inline-flex h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-[var(--md-sys-shape-corner-medium)] px-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary disabled:cursor-not-allowed disabled:opacity-40 sm:h-9 sm:min-w-9 ${toneClass} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}

export function ChromeDivider({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={`mx-0.5 h-5 w-px shrink-0 bg-md-outline-variant ${className}`} />
}
