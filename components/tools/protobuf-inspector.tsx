"use client"

import { useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, Copy, Download, ScanLine } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useTranslations } from "@/hooks/use-translations"
import { copyTextToClipboard } from "@/lib/clipboard"
import { bytesToHex } from "@/lib/binary"
import { downloadBlob } from "@/lib/object-url"
import { cn } from "@/lib/utils"
import { applyProtobufInterpretations, protobufFieldsToObject, protobufInterpretationOptions, type ProtobufField, type ProtobufInspection, type ProtobufInterpretation, type ProtobufInterpretations, type ProtobufObject } from "@/lib/protobuf-tools"

const FIELD_PAGE_SIZE = 50
const HEX_PAGE_SIZE = 256

interface FieldRow { field: ProtobufField; path: string; depth: number }

function flattenFields(fields: ProtobufField[], choices: ProtobufInterpretations, prefix = "", depth = 0): FieldRow[] {
  const counts = new Map<number, number>()
  const occurrences = new Map<number, number>()
  fields.forEach((field) => counts.set(field.fieldNumber, (counts.get(field.fieldNumber) ?? 0) + 1))
  return fields.flatMap((field) => {
    const occurrence = occurrences.get(field.fieldNumber) ?? 0
    occurrences.set(field.fieldNumber, occurrence + 1)
    const path = `${prefix}${field.fieldNumber}${counts.get(field.fieldNumber)! > 1 ? `[${occurrence}]` : ""}`
    const nested = choices[field.offset] === "message" || ((!choices[field.offset] || choices[field.offset] === "auto") && (field.kind === "message" || field.kind === "group"))
    return [{ field, path, depth }, ...(nested && field.children ? flattenFields(field.children, choices, `${path}.`, depth + 1) : [])]
  })
}

function preview(value: ProtobufField["value"]): string {
  if (typeof value === "string") return JSON.stringify(value.slice(0, 80)) + (value.length > 80 ? "…" : "")
  if (typeof value === "number") return String(value)
  if (Array.isArray(value)) return `[${value.slice(0, 8).map(preview).join(", ")}${value.length > 8 ? ", …" : ""}]`
  return `{ ${Object.keys(value).slice(0, 8).join(", ")}${Object.keys(value).length > 8 ? ", …" : ""} }`
}

export function ProtobufInspector({ inspection, readOnly = false, onValueChange }: {
  inspection: ProtobufInspection
  readOnly?: boolean
  onValueChange: (value: ProtobufObject) => void
}) {
  const t = useTranslations("protobuf.inspector")
  const [choices, setChoices] = useState<ProtobufInterpretations>({})
  const [selectedOffset, setSelectedOffset] = useState(inspection.fields[0]?.offset ?? 0)
  const [fieldPage, setFieldPage] = useState(0)
  const [hexPage, setHexPage] = useState(0)
  const [error, setError] = useState("")
  const [copyStatus, setCopyStatus] = useState("")
  const fields = useMemo(() => applyProtobufInterpretations(inspection, choices), [inspection, choices])
  const rows = useMemo(() => flattenFields(fields, choices), [fields, choices])
  const selectedRow = rows.find(({ field }) => field.offset === selectedOffset) ?? rows[0]
  const selected = selectedRow?.field
  const fieldPages = Math.max(1, Math.ceil(rows.length / FIELD_PAGE_SIZE))
  const currentFieldPage = Math.min(fieldPage, fieldPages - 1)
  const hexPages = Math.max(1, Math.ceil(inspection.bytes.length / HEX_PAGE_SIZE))
  const hexStart = hexPage * HEX_PAGE_SIZE
  const hexEnd = Math.min(hexStart + HEX_PAGE_SIZE, inspection.bytes.length)

  const selectRow = (row: FieldRow) => {
    setSelectedOffset(row.field.offset)
    setHexPage(Math.floor(row.field.offset / HEX_PAGE_SIZE))
    setFieldPage(Math.floor(rows.indexOf(row) / FIELD_PAGE_SIZE))
    setError("")
    setCopyStatus("")
  }

  const changeInterpretation = (interpretation: ProtobufInterpretation) => {
    if (!selected) return
    const next = { ...choices, [selected.offset]: interpretation }
    try {
      const resolved = applyProtobufInterpretations(inspection, next)
      onValueChange(protobufFieldsToObject(resolved))
      setChoices(next)
      setError("")
    } catch {
      setError(t("invalidInterpretation"))
    }
  }

  const copy = async (payloadOnly: boolean) => {
    if (!selected) return
    const value = bytesToHex(inspection.bytes.subarray(payloadOnly ? selected.dataOffset : selected.offset, payloadOnly ? selected.payloadEnd : selected.end))
    setCopyStatus(await copyTextToClipboard(value) ? t("copied") : t("copyFailed"))
  }

  return (
    <Card className="min-w-0" data-testid="protobuf-inspector">
      <CardHeader className="space-y-2 pb-4">
        <CardTitle className="flex items-center gap-2 text-lg"><ScanLine className="h-5 w-5 text-md-primary" />{t("title")}</CardTitle>
        <p className="text-sm text-md-on-surface-variant">{readOnly ? t("schemaHelp") : t("help")}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {selected && <div className="space-y-3 rounded-xl bg-md-surface-container-low p-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-sm">
            <strong>{t("field")} {selectedRow.path}</strong>
            <span>Wire {selected.wireType}</span>
            <span>{t("range")} [{selected.offset}, {selected.end})</span>
            <span>{t("payload")} [{selected.dataOffset}, {selected.payloadEnd}) · {selected.payloadEnd - selected.dataOffset} B</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!readOnly && <label className="flex flex-wrap items-center gap-2 text-sm">
              {t("interpretAs")}
              <select aria-label={t("interpretAs")} className="h-9 max-w-full rounded-lg border border-md-outline bg-md-surface px-2 text-md-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary" value={choices[selected.offset] ?? "auto"} onChange={(event) => changeInterpretation(event.target.value as ProtobufInterpretation)}>
                {protobufInterpretationOptions(selected).map((option) => <option value={option} key={option}>{t(`types.${option}`)}{option === "auto" ? ` (${t(`kinds.${selected.kind}`)})` : ""}</option>)}
              </select>
            </label>}
            <Button variant="outline" size="sm" onClick={() => void copy(false)}><Copy />{t("copyField")}</Button>
            <Button variant="outline" size="sm" onClick={() => void copy(true)}><Copy />{t("copyPayload")}</Button>
            <Button variant="outline" size="sm" onClick={() => downloadBlob(new Blob([inspection.bytes.slice(selected.dataOffset, selected.payloadEnd)]), `protobuf-field-${selectedRow.path}.bin`)}><Download />{t("downloadPayload")}</Button>
            <span role="status" className="text-sm text-md-primary">{copyStatus}</span>
          </div>
          <p className="break-all font-mono text-sm text-md-on-surface-variant">{preview(selected.value)}</p>
          {error && <p role="alert" className="text-sm text-md-error">{error}</p>}
        </div>}
        <div className="grid min-w-0 gap-4 xl:grid-cols-2">
          <div className="min-w-0 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-medium">{t("fields")} · {rows.length}</h3>
              <div className="flex items-center gap-2 text-xs">
                <Button variant="ghost" size="icon" aria-label={t("previousFields")} disabled={currentFieldPage === 0} onClick={() => setFieldPage(currentFieldPage - 1)}><ChevronLeft /></Button>
                <span>{currentFieldPage + 1} / {fieldPages}</span>
                <Button variant="ghost" size="icon" aria-label={t("nextFields")} disabled={currentFieldPage + 1 >= fieldPages} onClick={() => setFieldPage(currentFieldPage + 1)}><ChevronRight /></Button>
              </div>
            </div>
            <div className="max-h-[34rem] overflow-auto rounded-xl border border-md-outline-variant">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-md-surface-container"><tr><th className="p-3">{t("field")}</th><th className="p-3">Wire</th><th className="p-3">{t("range")}</th><th className="p-3">{t("value")}</th></tr></thead>
                <tbody>{rows.slice(currentFieldPage * FIELD_PAGE_SIZE, (currentFieldPage + 1) * FIELD_PAGE_SIZE).map((row) => <tr key={row.field.offset} className={cn("border-t border-md-outline-variant", selected?.offset === row.field.offset && "bg-md-primary-container text-md-on-primary-container")}>
                  <td className="p-2"><button type="button" aria-pressed={selected?.offset === row.field.offset} aria-label={`${t("field")} ${row.path} · ${row.field.offset}`} className="rounded px-2 py-1 font-mono font-semibold text-md-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary" style={{ marginInlineStart: Math.min(row.depth, 6) * 10 }} onClick={() => selectRow(row)}>{row.path}</button></td>
                  <td className="p-2 font-mono">{row.field.wireType}</td><td className="whitespace-nowrap p-2 font-mono">[{row.field.offset}, {row.field.end})</td><td className="max-w-48 truncate p-2 font-mono">{preview(row.field.value)}</td>
                </tr>)}</tbody>
              </table>
            </div>
          </div>
          <div className="min-w-0 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-medium">Hex · {inspection.bytes.length} B</h3>
              <div className="flex items-center gap-2 text-xs">
                <Button variant="ghost" size="icon" aria-label={t("previousBytes")} disabled={hexPage === 0} onClick={() => setHexPage(hexPage - 1)}><ChevronLeft /></Button>
                <span>{hexPage + 1} / {hexPages}</span>
                <Button variant="ghost" size="icon" aria-label={t("nextBytes")} disabled={hexPage + 1 >= hexPages} onClick={() => setHexPage(hexPage + 1)}><ChevronRight /></Button>
              </div>
            </div>
            <div className="overflow-x-auto rounded-xl border border-md-outline-variant bg-md-surface-container-low p-3">
              <div className="min-w-[28rem] font-mono text-xs">
                {Array.from({ length: Math.ceil((hexEnd - hexStart) / 16) }, (_, row) => {
                  const offset = hexStart + row * 16
                  return <div className="flex items-center" key={offset}>
                    <span className="w-16 shrink-0 text-md-on-surface-variant">{offset.toString(16).padStart(8, "0")}</span>
                    <div className="grid flex-1 grid-cols-16 gap-px" style={{ gridTemplateColumns: "repeat(16, minmax(0, 1fr))" }}>
                      {Array.from(inspection.bytes.subarray(offset, Math.min(offset + 16, hexEnd)), (byte, index) => {
                        const position = offset + index
                        const active = !!selected && position >= selected.offset && position < selected.end
                        const payload = active && position >= selected.dataOffset && position < selected.payloadEnd
                        return <button type="button" key={position} data-byte-offset={position} data-highlight={active ? payload ? "payload" : "header" : undefined} title={`${position} / 0x${position.toString(16)}`} aria-label={`${t("byte")} ${position}: ${byte.toString(16).padStart(2, "0")}`} className={cn("h-7 rounded-sm hover:outline hover:outline-1 hover:outline-md-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-md-primary", payload ? "bg-md-primary-container text-md-on-primary-container" : active ? "bg-md-tertiary-container text-md-on-tertiary-container" : "text-md-on-surface")} onClick={() => { const row = rows.findLast((item) => position >= item.field.offset && position < item.field.end); if (row) selectRow(row) }}>
                          {byte.toString(16).padStart(2, "0")}
                        </button>
                      })}
                    </div>
                  </div>
                })}
              </div>
            </div>
            <p className="flex flex-wrap items-center gap-3 text-xs text-md-on-surface-variant"><span className="rounded bg-md-tertiary-container px-2 py-1 text-md-on-tertiary-container">{t("headerLegend")}</span><span className="rounded bg-md-primary-container px-2 py-1 text-md-on-primary-container">{t("payload")}</span>{t("hexHelp")}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
