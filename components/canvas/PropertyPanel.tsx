"use client"

import { useMemo, useState } from "react"
import { getNodeDefinition } from "@/lib/canvas/registry"
import { useCanvasStore } from "@/lib/canvas/store"
import { formatCanvasValue } from "@/lib/canvas/format-value"
import { useTranslations } from "@/hooks/use-translations"
import { copyTextToClipboard } from "@/lib/clipboard"
import { Check, Copy, LoaderCircle, Play, RotateCcw, Trash2, X } from "lucide-react"
import { Label } from "@/components/ui/label"
import { ConfigInput } from "./nodes/ConfigInput"
import { ConfirmDialog } from "./workflow/ConfirmDialog"

function OutputField({ label, value }: { label: string; value: unknown }) {
  const t = useTranslations("canvas")
  const [copied, setCopied] = useState(false)
  const text = formatCanvasValue(value, true)

  const handleCopy = async () => {
    try {
      if (!await copyTextToClipboard(text)) throw new Error("Clipboard unavailable")
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-md-on-surface-variant">{label}</Label>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={copied ? t("copied") : t("copyOutput")}
          title={copied ? t("copied") : t("copyOutput")}
          className="rounded p-0.5 text-md-on-surface-variant transition-colors hover:bg-[var(--md-sys-color-on-surface)]/[0.08] hover:text-md-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary"
        >
          {copied
            ? <Check className="h-3 w-3 text-md-success" />
            : <Copy className="h-3 w-3" />}
        </button>
      </div>
      <div className="max-h-40 overflow-auto rounded-[var(--md-sys-shape-corner-extra-small)] bg-md-surface-container-high px-2 py-1.5 font-mono text-xs text-md-on-surface break-all">
        {text}
      </div>
    </div>
  )
}

interface PropertyPanelProps {
  onClose?: () => void
}

export function PropertyPanel({ onClose }: PropertyPanelProps = {}) {
  const t = useTranslations("canvas")
  const selectedNodeId = useCanvasStore((s) => s.selectedNodeId)
  const nodes = useCanvasStore((s) => s.nodes)
  const updateNodeConfig = useCanvasStore((s) => s.updateNodeConfig)
  const nodeOutputs = useCanvasStore((s) => s.nodeOutputs)
  const nodeErrors = useCanvasStore((s) => s.nodeErrors)
  const nodeRunning = useCanvasStore((s) => s.nodeRunning)
  const edges = useCanvasStore((s) => s.edges)
  const executeNode = useCanvasStore((s) => s.executeNode)
  const removeNode = useCanvasStore((s) => s.removeNode)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId),
    [nodes, selectedNodeId]
  )

  const definition = useMemo(
    () => (selectedNode ? getNodeDefinition(selectedNode.type) : undefined),
    [selectedNode]
  )

  if (!selectedNode || !definition) {
    return (
      <div className="flex h-full w-full items-center justify-center border-t border-md-outline-variant bg-md-surface-container-low p-4 lg:w-72 lg:border-l lg:border-t-0">
        <p className="text-center text-sm leading-6 text-md-on-surface-variant">{t("selectNodeToEdit")}</p>
      </div>
    )
  }

  const outputs = nodeOutputs[selectedNode.id]
  const error = nodeErrors[selectedNode.id]
  const running = nodeRunning[selectedNode.id]
  const incomingEdges = edges.filter((edge) => edge.target === selectedNode.id)

  return (
    <>
    <section className="flex h-full max-h-[72dvh] w-full flex-col rounded-t-2xl border-t border-md-outline-variant bg-md-surface-container-low shadow-2xl lg:max-h-none lg:w-72 lg:rounded-none lg:border-l lg:border-t-0 lg:shadow-none">
      <div className="flex min-h-12 items-center gap-2 border-b border-md-outline-variant p-2 pl-3">
        <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-md-on-surface">
          {definition.label}
        </h3>
        <button
          type="button"
          onClick={() => executeNode(selectedNode.id, undefined, false, true)}
          disabled={running}
          aria-label={error ? t("retryNode") : t("runNode")}
          title={error ? t("retryNode") : t("runNode")}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-md-on-surface-variant transition-colors hover:bg-[var(--md-sys-color-on-surface)]/[0.08] hover:text-md-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary disabled:opacity-50"
        >
          {running ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : error ? (
            <RotateCcw className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </button>
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          aria-label={t("deleteNode")}
          title={t("deleteNode")}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-md-on-surface-variant transition-colors hover:bg-md-error-container/60 hover:text-md-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-error"
        >
          <Trash2 className="h-4 w-4" />
        </button>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label={t("close")}
            title={t("close")}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-md-on-surface-variant transition-colors hover:bg-[var(--md-sys-color-on-surface)]/[0.08] hover:text-md-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="flex-1 space-y-4 overflow-auto p-3">
        {definition.config.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-xs font-medium uppercase text-md-on-surface-variant">
              {t("config")}
            </h4>
            {definition.config.map((field) => {
              const incomingEdge = field.hasInput
                ? incomingEdges.find((edge) => edge.targetPort === field.id)
                : undefined
              const fieldValue = incomingEdge
                ? nodeOutputs[incomingEdge.source]?.[incomingEdge.sourcePort]
                : selectedNode.config[field.id]

              return (
              <div key={field.id} className="space-y-1">
                <Label className="text-xs">{field.name}</Label>
                <ConfigInput
                  field={field}
                  value={fieldValue}
                  onChange={(v) =>
                    updateNodeConfig(selectedNode.id, {
                      ...selectedNode.config,
                      [field.id]: v,
                    })
                  }
                  disabled={Boolean(incomingEdge)}
                  allConfig={selectedNode.config}
                />
                {incomingEdge && (
                  <p className="text-[11px] text-md-primary">
                    {t("connectedInput")}
                  </p>
                )}
              </div>
              )
            })}
          </div>
        )}

        {outputs && Object.keys(outputs).length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-medium uppercase text-md-on-surface-variant">
              {t("outputs")}
            </h4>
            {Object.entries(outputs).map(([key, value]) => {
              const outputLabel = definition.outputs.find((output) => output.id === key)?.name
                ?? definition.config.find((field) => field.id === key)?.name
                ?? key
              return <OutputField key={key} label={outputLabel} value={value} />
            })}
          </div>
        )}
      </div>
    </section>
    {confirmDelete && (
      <ConfirmDialog
        title={t("deleteNodeTitle")}
        message={t("deleteNodeMessage")}
        confirmLabel={t("deleteNode")}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          removeNode(selectedNode.id)
          setConfirmDelete(false)
        }}
      />
    )}
    </>
  )
}
