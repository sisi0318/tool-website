"use client"

import { useReactFlow, useStore } from "@xyflow/react"
import { ChevronUp, Map as MapIcon, Network, Redo2, Undo2 } from "lucide-react"
import { useTranslations } from "@/hooks/use-translations"
import { zhCanvas } from "@/lib/translations/zh-namespaces/canvas"
import { useCanvasStore } from "@/lib/canvas/store"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MenuShortcut } from "./CanvasContextMenu"
import { ChromeButton, ChromeDivider, FLOATING_SURFACE, formatShortcut } from "./chrome"

interface ViewBarProps {
  minimapOpen: boolean
  onToggleMinimap: () => void
  onAutoLayout: () => void
  onFitView: () => void
  onZoomToSelection: () => void
}

const ZOOM_PRESETS = [0.5, 1, 2]
const ZOOM_DURATION = 200

/** 画布左下角：撤销、重做、小地图、自动排列，以及点开是缩放菜单的百分比 */
export function ViewBar({
  minimapOpen,
  onToggleMinimap,
  onAutoLayout,
  onFitView,
  onZoomToSelection,
}: ViewBarProps) {
  const t = useTranslations("canvas", zhCanvas)
  const { zoomIn, zoomOut, zoomTo } = useReactFlow()
  // 只在取整后的百分比变了才重渲染；平移画布不会动它
  const zoomPercent = useStore((state) => Math.round(state.transform[2] * 100))
  const nodeCount = useCanvasStore((state) => state.nodes.length)
  const hasSelection = useCanvasStore((state) => state.selectedNodeIds.length > 0)
  const canUndo = useCanvasStore((state) => state.canUndo)
  const canRedo = useCanvasStore((state) => state.canRedo)
  const undo = useCanvasStore((state) => state.undo)
  const redo = useCanvasStore((state) => state.redo)

  return (
    <div
      role="toolbar"
      aria-label={t("viewToolbar")}
      className={`${FLOATING_SURFACE} pointer-events-auto flex shrink-0 items-center gap-0.5 p-1`}
    >
      <ChromeButton label={t("undo")} shortcut={formatShortcut("mod+z")} onClick={undo} disabled={!canUndo}>
        <Undo2 aria-hidden="true" className="size-4" />
      </ChromeButton>
      <ChromeButton label={t("redo")} shortcut={formatShortcut("mod+shift+z")} onClick={redo} disabled={!canRedo}>
        <Redo2 aria-hidden="true" className="size-4" />
      </ChromeButton>

      <ChromeDivider />

      <ChromeButton
        label={t("minimap")}
        onClick={onToggleMinimap}
        active={minimapOpen}
        className="max-sm:hidden"
      >
        <MapIcon aria-hidden="true" className="size-4" />
      </ChromeButton>
      <ChromeButton label={t("autoLayout")} onClick={onAutoLayout} disabled={nodeCount < 2}>
        <Network aria-hidden="true" className="size-4" />
      </ChromeButton>

      <ChromeDivider />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <ChromeButton label={`${t("zoom")} ${zoomPercent}%`} className="gap-0.5 px-2 tabular-nums">
            <span className="min-w-9 text-center">{zoomPercent}%</span>
            <ChevronUp aria-hidden="true" className="size-3.5" />
          </ChromeButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="top" className="min-w-52">
          <DropdownMenuItem onSelect={() => void zoomIn({ duration: ZOOM_DURATION })}>
            {t("zoomIn")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void zoomOut({ duration: ZOOM_DURATION })}>
            {t("zoomOut")}
          </DropdownMenuItem>
          <DropdownMenuItem disabled={nodeCount === 0} onSelect={onFitView}>
            {t("fitView")}
            <MenuShortcut>{formatShortcut("shift+1")}</MenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!hasSelection} onSelect={onZoomToSelection}>
            {t("zoomToSelection")}
            <MenuShortcut>{formatShortcut("shift+2")}</MenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {ZOOM_PRESETS.map((zoom) => (
            <DropdownMenuItem key={zoom} onSelect={() => void zoomTo(zoom, { duration: ZOOM_DURATION })}>
              {zoom * 100}%
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
