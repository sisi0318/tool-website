"use client"

import type { LucideIcon } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export interface CanvasMenuItem {
  id: string
  label: string
  icon: LucideIcon
  /** 已经排好的快捷键文字，例如 formatShortcut("mod+c") */
  shortcut?: string
  disabled?: boolean
  danger?: boolean
  onSelect: () => void
}

export type CanvasMenuEntry = CanvasMenuItem | "separator"

interface CanvasContextMenuProps {
  /** 读屏用的菜单名称 */
  label: string
  /** 屏幕坐标：鼠标右键的位置 */
  position: { x: number; y: number }
  items: CanvasMenuEntry[]
  onClose: () => void
}

/** 菜单项右侧的快捷键 */
export function MenuShortcut({ children }: { children: React.ReactNode }) {
  return <span className="ml-auto pl-4 text-xs text-md-on-surface-variant">{children}</span>
}

/**
 * 画布的右键菜单。菜单本身用现成的下拉菜单（方向键、首字母、Esc、边缘避让都有了），
 * 只是把它的“触发按钮”换成一个钉在鼠标位置、看不见的锚点。
 */
export function CanvasContextMenu({ label, position, items, onClose }: CanvasContextMenuProps) {
  return (
    <DropdownMenu
      open
      modal={false}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          className="pointer-events-none fixed h-px w-px opacity-0"
          style={{ left: position.x, top: position.y }}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        // 锚点没有文字，菜单的名称直接写在这里
        aria-labelledby={undefined}
        aria-label={label}
        align="start"
        side="bottom"
        sideOffset={0}
        collisionPadding={8}
        className="min-w-52"
        // 关闭后不要把焦点放回那个看不见的锚点
        onCloseAutoFocus={(event) => event.preventDefault()}
        onContextMenu={(event) => event.preventDefault()}
      >
        {items.map((item, index) =>
          item === "separator" ? (
            <DropdownMenuSeparator key={`separator-${index}`} />
          ) : (
            <DropdownMenuItem
              key={item.id}
              disabled={item.disabled}
              onSelect={item.onSelect}
              className={item.danger ? "text-md-error focus:text-md-error" : undefined}
            >
              <item.icon aria-hidden="true" />
              {item.label}
              {item.shortcut && <MenuShortcut>{item.shortcut}</MenuShortcut>}
            </DropdownMenuItem>
          )
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
