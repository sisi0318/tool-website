"use client"

import { registerAllAdapters } from "@/lib/adapters"
import { inferDataType } from "@/lib/journey/tree"
import { ToolPickerSheet } from "@/components/journey/ToolPickerSheet"

registerAllAdapters()

export default function SendToToolDialog({ value, onClose, onPick }: { value: unknown; onClose: () => void; onPick: (tool: string) => void }) {
  const valueType = value instanceof ArrayBuffer || ArrayBuffer.isView(value) ? "bytes" : inferDataType(value)
  // 把数据本身也交给选择器：它按数据的样子把合适的工具排在前面
  return <ToolPickerSheet open onOpenChange={(open) => { if (!open) onClose() }} value={value} valueType={valueType} running={false} onPick={(definition) => onPick(definition.type)} />
}
