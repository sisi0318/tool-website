"use client"

import { useMemo, useState } from "react"
import { getNodeDefinition } from "@/lib/canvas/registry"
import { useCanvasStore } from "@/lib/canvas/store"
import { useTranslations } from "@/hooks/use-translations"
import { Copy, Check } from "lucide-react"
import { Label } from "@/components/ui/label"
import { ConfigInput } from "./nodes/ConfigInput"

function OutputField({ label, value }: { label: string; value: unknown }) {
  const [copied, setCopied] = useState(false)
  const text = typeof value === "object" ? JSON.stringify(value, null, 2) : String(value)

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-gray-500">{label}</Label>
        <button
          onClick={handleCopy}
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

export function PropertyPanel() {
  const t = useTranslations("canvas")
  const selectedNodeId = useCanvasStore((s) => s.selectedNodeId)
  const nodes = useCanvasStore((s) => s.nodes)
  const updateNodeConfig = useCanvasStore((s) => s.updateNodeConfig)
  const nodeOutputs = useCanvasStore((s) => s.nodeOutputs)

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
      <div className="w-72 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 flex items-center justify-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">{t("selectNodeToEdit")}</p>
      </div>
    )
  }

  const outputs = nodeOutputs[selectedNode.id]

  return (
    <div className="w-72 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex flex-col">
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
          {definition.label}
        </h3>
      </div>
      <div className="flex-1 overflow-auto p-3 space-y-4">
        {definition.config.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
              {t("config")}
            </h4>
            {definition.config.map((field) => (
              <div key={field.id} className="space-y-1">
                <Label className="text-xs">{field.name}</Label>
                <ConfigInput
                  field={field}
                  value={selectedNode.config[field.id]}
                  onChange={(v) =>
                    updateNodeConfig(selectedNode.id, {
                      ...selectedNode.config,
                      [field.id]: v,
                    })
                  }
                  disabled={false}
                  allConfig={selectedNode.config}
                />
              </div>
            ))}
          </div>
        )}

        {outputs && Object.keys(outputs).length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
              {t("outputs")}
            </h4>
            {Object.entries(outputs).map(([key, value]) => (
              <OutputField key={key} label={key} value={value} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
