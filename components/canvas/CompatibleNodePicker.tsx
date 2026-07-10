"use client"

import { useMemo, useRef, useState, type CSSProperties } from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { ArrowRight, Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { useTranslations } from "@/hooks/use-translations"
import {
  filterCompatibleNodeOptions,
  getCompatibleNodeOptions,
} from "@/lib/canvas/compatible-nodes"
import type { DataType, NodeDefinition } from "@/lib/canvas/types"

const CATEGORY_KEYS: Record<NodeDefinition["category"], string> = {
  basic: "categoryBasic",
  crypto: "categoryCrypto",
  data: "categoryData",
  image: "categoryImage",
  text: "categoryText",
  dev: "categoryDev",
  utility: "categoryUtility",
  viewer: "categoryViewer",
}

export interface CompatibleNodeSelection {
  nodeType: string
  targetPortId: string
}

export interface CompatibleNodePickerProps {
  sourceDataType: DataType
  position: { x: number; y: number }
  onSelect: (selection: CompatibleNodeSelection) => void
  onClose: () => void
}

type PickerPositionStyle = CSSProperties & {
  "--compatible-picker-left": string
  "--compatible-picker-top": string
}

export function CompatibleNodePicker({
  sourceDataType,
  position,
  onSelect,
  onClose,
}: CompatibleNodePickerProps) {
  const t = useTranslations("canvas")
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
    () => getCompatibleNodeOptions(sourceDataType),
    [sourceDataType]
  )
  const visibleOptions = useMemo(
    () => filterCompatibleNodeOptions(
      options,
      query,
      (category) => t(CATEGORY_KEYS[category])
    ),
    [options, query, t]
  )

  const safeX = Number.isFinite(position.x) ? position.x : 12
  const safeY = Number.isFinite(position.y) ? position.y : 12
  const panelStyle: PickerPositionStyle = {
    "--compatible-picker-left": `max(12px, min(${safeX + 12}px, calc(100vw - 364px)))`,
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
          className="fixed inset-x-3 bottom-3 z-[60] flex max-h-[calc(100dvh-1.5rem)] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 dark:border-gray-700 dark:bg-gray-900 sm:inset-x-auto sm:bottom-auto sm:left-[var(--compatible-picker-left)] sm:top-[var(--compatible-picker-top)] sm:max-h-[min(30rem,calc(100dvh-1.5rem))] sm:w-[22rem]"
        >
          <header className="border-b border-gray-200 pb-3 pl-4 pr-12 pt-4 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <DialogPrimitive.Title className="text-base font-semibold text-gray-900 dark:text-gray-100">
                {t("compatibleNodePickerTitle")}
              </DialogPrimitive.Title>
              <span className="rounded-full bg-blue-50 px-2 py-0.5 font-mono text-[11px] text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                {sourceDataType}
              </span>
            </div>
            <DialogPrimitive.Description className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">
              {t("compatibleNodePickerDescription").replace("{type}", sourceDataType)}
            </DialogPrimitive.Description>
          </header>

          <DialogPrimitive.Close
            aria-label={t("close")}
            className="absolute right-2 top-2 flex h-11 w-11 touch-manipulation items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100 sm:h-10 sm:w-10"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </DialogPrimitive.Close>

          <div className="border-b border-gray-200 p-3 dark:border-gray-700">
            <div className="relative">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500 dark:text-gray-400" />
              <Input
                ref={searchInputRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label={t("compatibleNodeSearchPlaceholder")}
                placeholder={t("compatibleNodeSearchPlaceholder")}
                className="h-11 rounded-md border border-gray-200 bg-gray-50 pl-9 text-sm dark:border-gray-700 dark:bg-gray-800 sm:h-10"
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2" role="list">
            {visibleOptions.length === 0 && (
              <p role="status" className="px-4 py-10 text-center text-sm leading-6 text-gray-500 dark:text-gray-400">
                {t("noCompatibleNodes")}
              </p>
            )}

            <div className="space-y-2">
              {visibleOptions.map((option) => {
                const { definition, compatibleInputs, defaultTargetPortId } = option
                const Icon = definition.icon
                const configuredPortId = selectedPorts[definition.type]
                const targetPortId = configuredPortId && compatibleInputs.some(
                  (input) => input.id === configuredPortId
                )
                  ? configuredPortId
                  : defaultTargetPortId
                const selectedInput = compatibleInputs.find(
                  (input) => input.id === targetPortId
                )!
                const targetDescriptionId = `compatible-node-${definition.type}-target`

                return (
                  <article
                    key={definition.type}
                    role="listitem"
                    className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
                  >
                    <button
                      type="button"
                      onClick={() => onSelect({
                        nodeType: definition.type,
                        targetPortId,
                      })}
                      aria-label={`${t("addAndConnect")}: ${definition.label}`}
                      aria-describedby={targetDescriptionId}
                      className="flex min-h-14 w-full touch-manipulation items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 active:bg-gray-100 dark:hover:bg-gray-800 dark:active:bg-gray-700"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800">
                        <Icon aria-hidden="true" className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                          {definition.label}
                        </span>
                        <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                          {t(CATEGORY_KEYS[definition.category])} · {definition.type}
                        </span>
                      </span>
                      <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 text-gray-400" />
                    </button>

                    <div
                      id={targetDescriptionId}
                      className="border-t border-gray-100 bg-gray-50/80 px-3 py-2 dark:border-gray-700 dark:bg-gray-800/60"
                    >
                      {compatibleInputs.length > 1 ? (
                        <label className="flex min-h-10 items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                          <span className="shrink-0">{t("targetInput")}</span>
                          <select
                            value={targetPortId}
                            onChange={(event) => setSelectedPorts((current) => ({
                              ...current,
                              [definition.type]: event.target.value,
                            }))}
                            aria-label={`${t("targetInput")}: ${definition.label}`}
                            className="h-11 min-w-0 flex-1 rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-800 outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 sm:h-9"
                          >
                            {compatibleInputs.map((input) => (
                              <option key={input.id} value={input.id}>
                                {input.name} · {input.dataType}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : (
                        <p className="truncate text-xs text-gray-600 dark:text-gray-300">
                          {t("targetInput")} · {selectedInput.name} · {selectedInput.dataType}
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
