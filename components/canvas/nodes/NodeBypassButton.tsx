"use client"

import { CircleSlash2, Power } from "lucide-react"
import { useTranslations } from "@/hooks/use-translations"
import { useCanvasStore } from "@/lib/canvas/store"

interface NodeBypassButtonProps {
  nodeId: string
  disabled: boolean
}

export function NodeBypassButton({ nodeId, disabled }: NodeBypassButtonProps) {
  const t = useTranslations("canvas")
  const setNodeDisabled = useCanvasStore((state) => state.setNodeDisabled)
  const label = disabled ? t("enableNode") : t("disableNode")

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        setNodeDisabled(nodeId, !disabled)
      }}
      aria-label={label}
      aria-pressed={disabled}
      title={label}
      className={`nodrag nopan ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary ${
        disabled
          ? "bg-md-tertiary-container text-md-on-tertiary-container"
          : "text-md-on-surface-variant hover:bg-md-tertiary-container/60 hover:text-md-on-tertiary-container"
      }`}
    >
      {disabled
        ? <Power aria-hidden="true" className="h-3.5 w-3.5" />
        : <CircleSlash2 aria-hidden="true" className="h-3.5 w-3.5" />}
    </button>
  )
}
