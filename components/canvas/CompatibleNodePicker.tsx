"use client"

import { useMemo, useRef, useState, type CSSProperties } from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { ArrowRight, Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { useTranslations } from "@/hooks/use-translations"
import { zhCanvas } from "@/lib/translations/zh-namespaces/canvas"
import { useNodeLabel } from "@/hooks/use-node-label"
import {
  filterCompatibleNodeOptions,
  getCompatibleNodeOptions,
  getCompatibleSourceOptions,
  type ConnectDirection,
} from "@/lib/canvas/compatible-nodes"
import type { DataType } from "@/lib/canvas/types"
import { CATEGORY_KEYS } from "./node-categories"

export interface CompatibleNodeSelection {
  nodeType: string
  /** 新节点上用来连接的端口：往后接时是它的输入，往前接时是它的输出 */
  portId: string
}

export interface CompatibleNodePickerProps {
  /** 手上那个端口的数据类型 */
  dataType: DataType
  /** downstream：手上是一个输出，挑接在后面的节点；upstream：手上是一个输入，挑接在前面的节点 */
  direction?: ConnectDirection
  position: { x: number; y: number }
  onSelect: (selection: CompatibleNodeSelection) => void
  onClose: () => void
}

/** 两个方向各自的文案键 */
const COPY = {
  downstream: {
    title: "compatibleNodePickerTitle",
    description: "compatibleNodePickerDescription",
    port: "targetInput",
  },
  upstream: {
    title: "sourceNodePickerTitle",
    description: "sourceNodePickerDescription",
    port: "sourceOutput",
  },
} as const

type PickerPositionStyle = CSSProperties & {
  "--compatible-picker-left": string
  "--compatible-picker-top": string
}

export function CompatibleNodePicker({
  dataType,
  direction = "downstream",
  position,
  onSelect,
  onClose,
}: CompatibleNodePickerProps) {
  const copy = COPY[direction]
  const t = useTranslations("canvas", zhCanvas)
  const nodeLabel = useNodeLabel()
  const searchInputRef = useRef<HTMLInputElement>(null)
  const closeRequestedRef = useRef(false)
  const [query, setQuery] = useState("")
  const [selectedPorts, setSelectedPorts] = useState<Record<string, string>>({})

  const requestClose = () => {
    if (closeRequestedRef.current) return
    closeRequestedRef.current = true
    onClose()
  }

  const options = useMemo(
    () => (direction === "upstream" ? getCompatibleSourceOptions(dataType) : getCompatibleNodeOptions(dataType)),
    [dataType, direction]
  )
  const visibleOptions = useMemo(
    () => filterCompatibleNodeOptions(
      options,
      query,
      (category) => t(CATEGORY_KEYS[category]),
      nodeLabel
    ),
    [nodeLabel, options, query, t]
  )

  const safeX = Number.isFinite(position.x) ? position.x : 12
  const safeY = Number.isFinite(position.y) ? position.y : 12
  // 往后接时面板在落点右侧；往前接时在左侧，免得盖住手上这个节点
  const panelLeft = direction === "upstream" ? safeX - 364 : safeX + 12
  const panelStyle: PickerPositionStyle = {
    "--compatible-picker-left": `max(12px, min(${panelLeft}px, calc(100vw - 364px)))`,
    "--compatible-picker-top": `max(12px, min(${safeY + 12}px, calc(100dvh - 500px)))`,
  }

  return (
    <DialogPrimitive.Root
      open
      onOpenChange={(open) => {
        if (!open) requestClose()
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          data-testid="compatible-node-picker-overlay"
          onPointerDown={(event) => {
            if (event.button === 0) requestClose()
          }}
          className="fixed inset-0 z-[59] bg-black/25 backdrop-blur-[1px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        />
        <DialogPrimitive.Content
          data-testid="compatible-node-picker"
          style={panelStyle}
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            searchInputRef.current?.focus()
          }}
          className="fixed inset-x-3 bottom-3 z-[60] flex max-h-[calc(100dvh-1.5rem)] flex-col overflow-hidden rounded-[var(--md-sys-shape-corner-large)] border border-md-outline-variant bg-md-surface-container-high text-md-on-surface shadow-2xl outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 sm:inset-x-auto sm:bottom-auto sm:left-[var(--compatible-picker-left)] sm:top-[var(--compatible-picker-top)] sm:max-h-[min(30rem,calc(100dvh-1.5rem))] sm:w-[22rem]"
        >
          <header className="border-b border-md-outline-variant pb-3 pl-4 pr-12 pt-4">
            <div className="flex items-center gap-2">
              <DialogPrimitive.Title className="text-base font-semibold text-md-on-surface">
                {t(copy.title)}
              </DialogPrimitive.Title>
              <span className="rounded-full bg-md-secondary-container px-2 py-0.5 font-mono text-[11px] text-md-on-secondary-container">
                {dataType}
              </span>
            </div>
            <DialogPrimitive.Description className="mt-1 text-xs leading-5 text-md-on-surface-variant">
              {t(copy.description).replace("{type}", dataType)}
            </DialogPrimitive.Description>
          </header>

          <DialogPrimitive.Close
            aria-label={t("close")}
            className="absolute right-2 top-2 flex h-11 w-11 touch-manipulation items-center justify-center rounded-full text-md-on-surface-variant transition-colors hover:bg-md-hover hover:text-md-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary sm:h-10 sm:w-10"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </DialogPrimitive.Close>

          <div className="border-b border-md-outline-variant p-3">
            <div className="relative">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-md-on-surface-variant" />
              <Input
                ref={searchInputRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && visibleOptions.length > 0) {
                    event.preventDefault()
                    const first = visibleOptions[0]
                    const configured = selectedPorts[first.definition.type]
                    const portId = configured && first.ports.some((port) => port.id === configured)
                      ? configured
                      : first.defaultPortId
                    onSelect({ nodeType: first.definition.type, portId })
                  }
                }}
                aria-label={t("compatibleNodeSearchPlaceholder")}
                placeholder={t("compatibleNodeSearchPlaceholder")}
                className="h-11 rounded-[var(--md-sys-shape-corner-small)] border border-md-outline-variant bg-md-surface-container-lowest pl-9 text-sm text-md-on-surface placeholder:text-md-on-surface-variant sm:h-10"
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2" role="list">
            {visibleOptions.length === 0 && (
              <p role="status" className="px-4 py-10 text-center text-sm leading-6 text-md-on-surface-variant">
                {t("noCompatibleNodes")}
              </p>
            )}

            <div className="space-y-2">
              {visibleOptions.map((option) => {
                const { definition, ports, defaultPortId } = option
                const Icon = definition.icon
                const configuredPortId = selectedPorts[definition.type]
                const portId = configuredPortId && ports.some((port) => port.id === configuredPortId)
                  ? configuredPortId
                  : defaultPortId
                const selectedPort = ports.find((port) => port.id === portId)!
                const targetDescriptionId = `compatible-node-${definition.type}-target`

                return (
                  <article
                    key={definition.type}
                    role="listitem"
                    className="overflow-hidden rounded-[var(--md-sys-shape-corner-medium)] border border-md-outline-variant bg-md-surface-container-low"
                  >
                    <button
                      type="button"
                      onClick={() => onSelect({ nodeType: definition.type, portId })}
                      aria-label={`${t("addAndConnect")}: ${nodeLabel(definition)}`}
                      aria-describedby={targetDescriptionId}
                      className="flex min-h-14 w-full touch-manipulation items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-md-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-md-primary active:bg-md-pressed"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--md-sys-shape-corner-small)] bg-md-secondary-container text-md-on-secondary-container">
                        <Icon aria-hidden="true" className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-md-on-surface">
                          {nodeLabel(definition)}
                        </span>
                        <span className="block truncate text-xs text-md-on-surface-variant">
                          {t(CATEGORY_KEYS[definition.category])} · {definition.type}
                        </span>
                      </span>
                      <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 text-md-on-surface-variant" />
                    </button>

                    <div
                      id={targetDescriptionId}
                      className="border-t border-md-outline-variant bg-md-surface-container px-3 py-2"
                    >
                      {ports.length > 1 ? (
                        <label className="flex min-h-10 items-center gap-2 text-xs text-md-on-surface-variant">
                          <span className="shrink-0">{t(copy.port)}</span>
                          <select
                            value={portId}
                            onChange={(event) => setSelectedPorts((current) => ({
                              ...current,
                              [definition.type]: event.target.value,
                            }))}
                            aria-label={`${t(copy.port)}: ${nodeLabel(definition)}`}
                            className="h-11 min-w-0 flex-1 rounded-[var(--md-sys-shape-corner-small)] border border-md-outline-variant bg-md-surface-container-lowest px-2 text-xs text-md-on-surface outline-none focus-visible:ring-2 focus-visible:ring-md-primary sm:h-9"
                          >
                            {ports.map((port) => (
                              <option key={port.id} value={port.id}>
                                {port.name} · {port.dataType}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : (
                        <p className="truncate text-xs text-md-on-surface-variant">
                          {t(copy.port)} · {selectedPort.name} · {selectedPort.dataType}
                        </p>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
