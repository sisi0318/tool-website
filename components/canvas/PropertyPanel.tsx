"use client"

import { useMemo, useState } from "react"
import { getNodeDefinition } from "@/lib/canvas/registry"
import { useCanvasStore } from "@/lib/canvas/store"
import { formatCanvasValue } from "@/lib/canvas/format-value"
import { useTranslations } from "@/hooks/use-translations"
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
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-gray-500">{label}</Label>
        <button
          onClick={handleCopy}
          aria-label={copied ? t("copied") : t("copyOutput")}
          title={copied ? t("copied") : t("copyOutput")}
          className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          {copied
            ? <Check className="w-3 h-3 text-green-500" />
            : <Copy className="w-3 h-3" />}
        </button>
      </div>
      <div className="px-2 py-1.5 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono break-all max-h-40 overflow-auto">
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
      <div className="flex h-full w-full items-center justify-center border-t border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900 lg:w-72 lg:border-l lg:border-t-0">
        <p className="text-sm text-gray-500 dark:text-gray-400">{t("selectNodeToEdit")}</p>
      </div>
    )
  }

  const outputs = nodeOutputs[selectedNode.id]
  const error = nodeErrors[selectedNode.id]
  const running = nodeRunning[selectedNode.id]
  const incomingEdges = edges.filter((edge) => edge.target === selectedNode.id)

  return (
    <>
    <section className="flex h-full max-h-[72dvh] w-full flex-col rounded-t-2xl border-t border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900 lg:max-h-none lg:w-72 lg:rounded-none lg:border-l lg:border-t-0 lg:shadow-none">
      <div className="flex min-h-12 items-center gap-2 border-b border-gray-200 p-2 pl-3 dark:border-gray-700">
        <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-800 dark:text-gray-200">
          {definition.label}
        </h3>
        <button
          type="button"
          onClick={() => executeNode(selectedNode.id, undefined, false, true)}
          disabled={running}
          aria-label={error ? t("retryNode") : t("runNode")}
          title={error ? t("retryNode") : t("runNode")}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
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
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-500 hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:text-gray-400 dark:hover:bg-red-950/40 dark:hover:text-red-400"
        >
          <Trash2 className="h-4 w-4" />
        </button>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label={t("close")}
            title={t("close")}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100 lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="flex-1 overflow-auto p-3 space-y-4">
        {definition.config.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
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
                  <p className="text-[11px] text-blue-600 dark:text-blue-400">
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
            <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
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
