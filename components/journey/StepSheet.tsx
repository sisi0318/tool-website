"use client"

import { useEffect, useState } from "react"
import { LoaderCircle, Trash2 } from "lucide-react"
import type { ConfigField } from "@/lib/canvas/types"
import { getNodeDefinition } from "@/lib/canvas/registry"
import { withDefaultConfig } from "@/lib/canvas/node-factory"
import { getMainInputPort, getOutputPorts } from "@/lib/journey/engine"
import type { JourneyNode } from "@/lib/journey/types"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { JOURNEY_DIALOG_CLASS } from "./dialog-style"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useTranslations } from "@/hooks/use-translations"

const SELECT_CLASS =
  "h-11 w-full rounded-xl border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-highest)] px-3 text-sm text-[var(--md-sys-color-on-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--md-sys-color-primary)]"

interface StepSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The active node whose `via` step is being inspected; null when not applicable. */
  node: JourneyNode | null
  running: boolean
  onRerun: (config: Record<string, unknown>, outputPort: string) => void
  onDelete: () => void
  creating?: boolean
}

export function StepSheet({ open, onOpenChange, node, running, onRerun, onDelete, creating = false }: StepSheetProps) {
  const t = useTranslations("journey")
  const via = node?.via ?? null
  const [draft, setDraft] = useState<Record<string, unknown>>({})
  const [outputPort, setOutputPort] = useState("")

  useEffect(() => {
    if (open && via) {
      // 旧存档与分享链接里的步骤可能只带部分配置;缺省字段不补齐的话,
      // 联动下拉(如哈希算法依赖分类)会拿到空串而退化成一个空文本框
      setDraft(withDefaultConfig(via.tool, via.config))
      setOutputPort(via.outputPort)
    }
  }, [open, via])

  const definition = via ? getNodeDefinition(via.tool) : undefined
  const mainPortId = definition ? getMainInputPort(definition)?.id : undefined
  const ports = definition ? getOutputPorts(definition) : []
  const fields = definition
    ? definition.config.filter(
        (field) => field.id !== mainPortId && (!field.visible || field.visible(draft)),
      )
    : []

  const setField = (id: string, value: unknown) =>
    setDraft((prev) => {
      const next = { ...prev, [id]: value }
      // 父字段变了,依赖它的联动下拉要换选项;旧值不在新列表里就落到第一项,
      // 否则提交的会是「分类 sha2 + 算法 md5」这种自相矛盾的组合
      for (const dependent of definition?.config ?? []) {
        if (dependent.dependsOn !== id || !dependent.dynamicOptions) continue
        const options = dependent.dynamicOptions(String(value ?? ""))
        const current = String(next[dependent.id] ?? "")
        if (options.length > 0 && !options.some((option) => option.value === current)) {
          next[dependent.id] = options[0].value
        }
      }
      return next
    })

  const renderField = (field: ConfigField) => {
    const raw = draft[field.id] ?? field.defaultValue
    if (field.dataType === "boolean") {
      return (
        <Switch
          checked={Boolean(raw ?? false)}
          onCheckedChange={(checked) => setField(field.id, checked)}
          aria-label={field.name}
        />
      )
    }
    const options =
      field.dependsOn && field.dynamicOptions
        ? field.dynamicOptions(String(draft[field.dependsOn] ?? ""))
        : field.options
    if (options && options.length > 0) {
      return (
        <select
          value={String(raw ?? options[0].value)}
          onChange={(event) => setField(field.id, event.target.value)}
          aria-label={field.name}
          className={SELECT_CLASS}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )
    }
    if (field.dataType === "number") {
      return (
        <Input
          type="number"
          value={String(raw ?? 0)}
          min={field.slider?.min}
          max={field.slider?.max}
          step={field.slider?.step}
          onChange={(event) => {
            const parsed = Number(event.target.value)
            setField(field.id, Number.isNaN(parsed) ? 0 : parsed)
          }}
          aria-label={field.name}
          className="rounded-xl"
        />
      )
    }
    if (field.multiline) {
      return (
        <Textarea
          value={String(raw ?? "")}
          rows={3}
          onChange={(event) => setField(field.id, event.target.value)}
          aria-label={field.name}
          className="rounded-xl border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-highest)] font-mono text-xs text-[var(--md-sys-color-on-surface)]"
        />
      )
    }
    return (
      <Input
        value={String(raw ?? "")}
        onChange={(event) => setField(field.id, event.target.value)}
        aria-label={field.name}
        className="rounded-xl"
      />
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`max-w-lg ${JOURNEY_DIALOG_CLASS}`}>
        <DialogHeader>
          <DialogTitle className="text-[var(--md-sys-color-on-surface)]">
            {t("stepConfigTitle")}
            {definition && (
              <span className="ml-2 text-sm font-normal text-[var(--md-sys-color-on-surface-variant)]">
                {definition.label}
              </span>
            )}
          </DialogTitle>
          <DialogDescription>{t(creating ? "configureNewStep" : "configureExistingStep")}</DialogDescription>
        </DialogHeader>
        <div className="max-h-[55vh] space-y-4 overflow-y-auto pr-1">
          {fields.length === 0 && ports.length <= 1 && (
            <p className="text-sm text-[var(--md-sys-color-on-surface-variant)]">{t("noConfig")}</p>
          )}
          {fields.map((field) => (
            <div key={field.id} className="space-y-1.5">
              <Label className="text-xs text-[var(--md-sys-color-on-surface-variant)]">{field.name}</Label>
              <div>{renderField(field)}</div>
            </div>
          ))}
          {ports.length > 1 && (
            <div className="space-y-1.5">
              <Label className="text-xs text-[var(--md-sys-color-on-surface-variant)]">{t("outputPortLabel")}</Label>
              <select
                value={outputPort || (ports[0]?.id ?? "")}
                onChange={(event) => setOutputPort(event.target.value)}
                aria-label={t("outputPortLabel")}
                className={SELECT_CLASS}
              >
                {ports.map((port) => (
                  <option key={port.id} value={port.id}>
                    {port.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          {!creating && <Button
            variant="outline"
            onClick={onDelete}
            disabled={running}
            className="rounded-full border-[var(--md-sys-color-outline-variant)] text-[var(--md-sys-color-error)] hover:bg-[var(--md-sys-color-error-container)]/40"
          >
            <Trash2 className="h-4 w-4" />
            {t("deleteStep")}
          </Button>}
          <Button
            onClick={() => onRerun(draft, outputPort || (ports[0]?.id ?? ""))}
            disabled={running || !definition}
            className="rounded-full bg-[var(--md-sys-color-primary)] px-6 text-[var(--md-sys-color-on-primary)] hover:bg-[var(--md-sys-color-primary)]/90"
          >
            {running && <LoaderCircle className="h-4 w-4 animate-spin" />}
            {t(creating ? "runNewStep" : "rerunPath")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
