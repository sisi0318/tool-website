'use client';

import { useState, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { M3Card } from "@/components/m3/card"
import { M3Chip } from "@/components/m3/chip"
import { M3ContextMenu, type M3ContextMenuItem } from "@/components/m3/context-menu"
import type { LucideIcon } from "lucide-react"
import * as LucideIcons from "lucide-react"
import { ExternalLink, Share2, Star, Copy } from "lucide-react"
import { useBreakpoint } from "@/hooks/use-breakpoint"
import { useLongPress } from "@/hooks/use-long-press"
import { cn } from "@/lib/utils"

/**
 * M3 Tool Grid Component
 * 
 * Implements Material You 3 Expressive tool card grid with:
 * - M3 Card component with elevated/filled variants
 * - Hover and pressed state layers with appropriate opacity values
 * - Icon containers with tonal surface colors
 * - Responsive grid layout (single column for compact, two for medium, multi for expanded)
 * - Long-press context menu for quick actions (mobile)
 * 
 * Requirements: 8.1, 8.2, 8.3, 8.4, 6.1, 6.2, 6.3, 13.4, 17.3
 */

interface Tool {
  id: string
  name: string
  description: string
  icon: string
  href: string
  category?: string
  isNew?: boolean
  isPopular?: boolean
}

interface ToolGridProps {
  tools: Tool[]
  showDescription?: boolean
  /** Callback when a tool is added to favorites */
  onAddToFavorites?: (tool: Tool) => void
  /** Callback when a tool link is copied */
  onCopyLink?: (tool: Tool) => void
  /** Callback when a tool is opened in new tab */
  onOpenInNewTab?: (tool: Tool) => void
}

/**
 * M3 EXPRESSIVE Icon Container Component
 * Renders icons inside gradient M3 tonal surface containers
 */
function IconContainer({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div 
      className={cn(
        "flex items-center justify-center",
        "w-14 h-14",
        "rounded-[var(--md-sys-shape-corner-large)]",
        "bg-gradient-to-br from-[var(--md-sys-color-primary-container)] to-[var(--md-sys-color-tertiary-container)]",
        "text-[var(--md-sys-color-on-primary-container)]",
        "shadow-md",
        "transition-all duration-[var(--md-sys-motion-duration-medium2)]",
        "ease-[var(--md-sys-motion-easing-expressive)]",
        "group-hover:scale-110 group-hover:rotate-3 group-hover:shadow-lg",
        className
      )}
    >
      {children}
    </div>
  )
}

interface ToolCardProps {
  tool: Tool
  showDescription: boolean
  onLongPress?: (tool: Tool, position: { x: number; y: number }) => void
}

/**
 * M3 EXPRESSIVE Tool Card Component
 * Individual tool card with expressive styling and long-press support
 */
function ToolCard({ tool, showDescription, onLongPress }: ToolCardProps) {
  const router = useRouter()
  
  // Dynamically get icon component
  const IconComponent = LucideIcons[tool.icon as keyof typeof LucideIcons] as LucideIcon

  // Long press handler for context menu
  const { handlers: longPressHandlers, isPressed } = useLongPress({
    duration: 500,
    onLongPress: (e) => {
      const touch = 'touches' in e ? e.touches[0] : e
      const position = {
        x: 'clientX' in touch ? touch.clientX : 0,
        y: 'clientY' in touch ? touch.clientY : 0,
      }
      onLongPress?.(tool, position)
    },
  })

  // Handle click - navigate to tool
  const handleClick = useCallback((e: React.MouseEvent) => {
    if (isPressed) {
      e.preventDefault()
      return
    }
    router.push(tool.href)
  }, [isPressed, router, tool.href])

  return (
    <div 
      className="block group cursor-pointer"
      {...longPressHandlers}
      onClick={handleClick}
    >
      <M3Card
        variant="elevated"
        shape="extraLarge"
        interactive
        fullWidth
        className={cn(
          "h-full min-h-[140px]",
          "p-0",
          // Expressive visual feedback during long press
          isPressed && "scale-[0.97] transition-transform duration-150"
        )}
      >
        <div className="p-6">
          {/* Header: Icon and Badges */}
          <div className="flex items-start justify-between mb-4">
            {IconComponent && (
              <IconContainer>
                <IconComponent className="h-7 w-7" />
              </IconContainer>
            )}
            
            {/* Badge container */}
            <div className="flex gap-2 flex-wrap justify-end">
              {tool.isNew && (
                <M3Chip
                  variant="suggestion"
                  elevated
                  className={cn(
                    "h-7 px-3 text-xs font-semibold",
                    "bg-gradient-to-r from-[var(--md-sys-color-tertiary-container)] to-[var(--md-sys-color-secondary-container)]",
                    "text-[var(--md-sys-color-on-tertiary-container)]",
                    "border-transparent cursor-default shadow-sm"
                  )}
                >
                  新
                </M3Chip>
              )}
              {tool.isPopular && (
                <M3Chip
                  variant="suggestion"
                  elevated
                  className={cn(
                    "h-7 px-3 text-xs font-semibold",
                    "bg-gradient-to-r from-[var(--md-sys-color-secondary-container)] to-[var(--md-sys-color-primary-container)]",
                    "text-[var(--md-sys-color-on-secondary-container)]",
                    "border-transparent cursor-default shadow-sm"
                  )}
                >
                  热门
                </M3Chip>
              )}
            </div>
          </div>
          
          {/* Tool Name - M3 Title Medium */}
          <h3 
            className={cn(
              "font-semibold text-base leading-6",
              "text-[var(--md-sys-color-on-surface)]",
              "mb-2",
              "transition-all duration-[var(--md-sys-motion-duration-medium2)]",
              "group-hover:text-gradient"
            )}
          >
            {tool.name}
          </h3>
          
          {/* Tool Description - M3 Body Small */}
          {showDescription && (
            <p 
              className={cn(
                "text-sm leading-5",
                "text-[var(--md-sys-color-on-surface-variant)]",
                "line-clamp-2"
              )}
            >
              {tool.description}
            </p>
          )}
          
          {/* Category - M3 Label Small */}
          {tool.category && (
            <div 
              className={cn(
                "mt-4 pt-4",
                "border-t border-[var(--md-sys-color-outline-variant)]/50"
              )}
            >
              <span 
                className={cn(
                  "text-xs font-semibold",
                  "text-[var(--md-sys-color-on-surface-variant)]"
                )}
              >
                {tool.category}
              </span>
            </div>
          )}
        </div>
      </M3Card>
    </div>
  )
}

/**
 * M3 Tool Grid Component
 * Responsive grid layout following M3 breakpoints with long-press context menu
 * Requirements: 6.1, 6.2, 6.3, 13.4, 17.3
 */
export function ToolGrid({ 
  tools, 
  showDescription = false,
  onAddToFavorites,
  onCopyLink,
  onOpenInNewTab,
}: ToolGridProps) {
  const { isCompact, isMedium } = useBreakpoint()
  
  // Context menu state
  const [contextMenuOpen, setContextMenuOpen] = useState(false)
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 })
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null)

  // Handle long press on tool card
  const handleLongPress = useCallback((tool: Tool, position: { x: number; y: number }) => {
    setSelectedTool(tool)
    setContextMenuPosition(position)
    setContextMenuOpen(true)
  }, [])

  // Close context menu
  const handleCloseContextMenu = useCallback(() => {
    setContextMenuOpen(false)
    setSelectedTool(null)
  }, [])

  // Context menu items
  const contextMenuItems: M3ContextMenuItem[] = selectedTool ? [
    {
      id: 'open-new-tab',
      label: '在新标签页打开',
      icon: <ExternalLink className="w-5 h-5" />,
      onClick: () => {
        if (selectedTool) {
          window.open(selectedTool.href, '_blank')
          onOpenInNewTab?.(selectedTool)
        }
      },
    },
    {
      id: 'copy-link',
      label: '复制链接',
      icon: <Copy className="w-5 h-5" />,
      onClick: () => {
        if (selectedTool && typeof window !== 'undefined') {
          const url = `${window.location.origin}${selectedTool.href}`
          navigator.clipboard.writeText(url)
          onCopyLink?.(selectedTool)
        }
      },
    },
    {
      id: 'share',
      label: '分享',
      icon: <Share2 className="w-5 h-5" />,
      onClick: () => {
        if (selectedTool && typeof navigator !== 'undefined' && navigator.share) {
          navigator.share({
            title: selectedTool.name,
            text: selectedTool.description,
            url: `${window.location.origin}${selectedTool.href}`,
          }).catch(() => {
            // User cancelled or share failed
          })
        }
      },
    },
    {
      id: 'add-favorite',
      label: '添加到收藏',
      icon: <Star className="w-5 h-5" />,
      onClick: () => {
        if (selectedTool) {
          onAddToFavorites?.(selectedTool)
        }
      },
    },
  ] : []

  return (
    <>
      <div 
        className={cn(
          "grid gap-4",
          // Responsive grid columns based on M3 breakpoints
          // Compact (<600px): Single column (Req 6.1)
          // Medium (600-840px): Two columns (Req 6.2)
          // Expanded (>840px): Multi-column (Req 6.3)
          isCompact && "grid-cols-1",
          isMedium && "grid-cols-2",
          !isCompact && !isMedium && "grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        )}
      >
        {tools.map((tool) => (
          <ToolCard 
            key={tool.id} 
            tool={tool} 
            showDescription={showDescription}
            onLongPress={handleLongPress}
          />
        ))}
      </div>

      {/* Context Menu for long-press actions */}
      <M3ContextMenu
        open={contextMenuOpen}
        onClose={handleCloseContextMenu}
        items={contextMenuItems}
        position={contextMenuPosition}
        aria-label="工具快捷操作"
      />
    </>
  )
}
