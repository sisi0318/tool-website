import { useCanvasStore } from "@/lib/canvas/store"
import type { NodeDefinition } from "@/lib/canvas/types"
import { StringEditor } from "./editors/StringEditor"
import { NumberEditor } from "./editors/NumberEditor"
import { JsonEditor } from "./editors/JsonEditor"
import { FileEditor } from "./editors/FileEditor"

interface InlineEditorProps {
  nodeId: string
  definition: NodeDefinition
}

export function InlineEditor({ nodeId, definition }: InlineEditorProps) {
  const edges = useCanvasStore((s) => s.edges)
  const config = useCanvasStore((s) => {
    const node = s.nodes.find((n) => n.id === nodeId)
    return node?.config ?? {}
  })
  const updateConfig = useCanvasStore((s) => s.updateNodeConfig)

  const isInputConnected = (portId: string) => {
    return edges.some((e) => e.target === nodeId && e.targetPort === portId)
  }

  switch (definition.type) {
    case "string":
      return (
        <StringEditor
          value={String(config.value ?? "")}
          disabled={isInputConnected("input")}
          onChange={(v) => updateConfig(nodeId, { ...config, value: v })}
        />
      )
    case "number":
      return (
        <NumberEditor
          value={Number(config.value ?? 0)}
          disabled={isInputConnected("input")}
          onChange={(v) => updateConfig(nodeId, { ...config, value: v })}
        />
      )
    case "json":
      return (
        <JsonEditor
          value={String(config.value ?? "{}")}
          disabled={isInputConnected("input")}
          onChange={(v) => updateConfig(nodeId, { ...config, value: v })}
        />
      )
    case "file":
      return (
        <FileEditor
          disabled={isInputConnected("input")}
          file={config.file instanceof File ? config.file : null}
          onFileChange={(f) => updateConfig(nodeId, { ...config, file: f })}
        />
      )
    default:
      return null
  }
}
