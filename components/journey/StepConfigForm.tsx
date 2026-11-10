"use client"

import type { ConfigField, NodeDefinition } from "@/lib/canvas/types"
import { getNodeDefinition } from "@/lib/canvas/registry"
import { withDefaultConfig } from "@/lib/canvas/node-factory"
import { getMainInputPort, getOutputPorts, resolveOutputPort } from "@/lib/journey/engine"
import type { JourneyStep } from "@/lib/journey/types"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useTranslations } from "@/hooks/use-translations"
import { zhJourney } from "@/lib/translations/zh-namespaces/journey"

const SELECT_CLASS =
  "h-11 w-full rounded-xl border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-highest)] px-3 text-sm text-[var(--md-sys-color-on-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--md-sys-color-primary)]"

/** 正在编辑的一步：完整的配置和选中的输出 */
export interface StepDraft {
  config: Record<string, unknown>
  outputPort: string
}

/**
 * 旧存档与分享链接里的步骤可能只带部分配置；缺省字段不补齐的话，
 * 联动下拉（如哈希算法依赖分类）会拿到空串而退化成一个空文本框。
 */
export function draftOf(step: JourneyStep): StepDraft {
  const definition = getNodeDefinition(step.tool)
  return {
    config: withDefaultConfig(step.tool, step.config),
    outputPort: definition ? resolveOutputPort(definition, step.outputPort) : step.outputPort,
  }
}

function visibleFields(definition: NodeDefinition, config: Record<string, unknown>): ConfigField[] {
  const mainPortId = getMainInputPort(definition)?.id
  return definition.config.filter((field) => field.id !== mainPortId && (!field.visible || field.visible(config)))
}

/** 这一步有没有可调的东西：参数，或者不止一个可传下去的输出 */
export function hasStepSettings(step: JourneyStep): boolean {
  const definition = getNodeDefinition(step.tool)
  if (!definition) return false
  return visibleFields(definition, withDefaultConfig(step.tool, step.config)).length > 0 || getOutputPorts(definition).length > 1
}

interface StepConfigFormProps {
  tool: string
  draft: StepDraft
  onChange: (draft: StepDraft) => void
  disabled?: boolean
  /** 一行排几个字段：面板里一列，详情区里宽度够时两列 */
  columns?: 1 | 2
}

/** 一步的参数表单。只管编辑，不管什么时候运行 */
export function StepConfigForm({ tool, draft, onChange, disabled = false, columns = 1 }: StepConfigFormProps) {
  const t = useTranslations("journey", zhJourney)
  const definition = getNodeDefinition(tool)
  if (!definition) return null

  const fields = visibleFields(definition, draft.config)
  const ports = getOutputPorts(definition)

  const setField = (id: string, value: unknown) => {
    const next = { ...draft.config, [id]: value }
    // 父字段变了，依赖它的联动下拉要换选项；旧值不在新列表里就落到第一项，
    // 否则提交的会是「分类 sha2 + 算法 md5」这种自相矛盾的组合
    for (const dependent of definition.config) {
      if (dependent.dependsOn !== id || !dependent.dynamicOptions) continue
      const options = dependent.dynamicOptions(String(value ?? ""))
      const current = String(next[dependent.id] ?? "")
      if (options.length > 0 && !options.some((option) => option.value === current)) next[dependent.id] = options[0].value
    }
    onChange({ ...draft, config: next })
  }

  const renderField = (field: ConfigField) => {
    const raw = draft.config[field.id] ?? field.defaultValue
    if (field.dataType === "boolean") {
      return <Switch checked={Boolean(raw ?? false)} disabled={disabled} onCheckedChange={(checked) => setField(field.id, checked)} aria-label={field.name} />
    }
    const options = field.dependsOn && field.dynamicOptions ? field.dynamicOptions(String(draft.config[field.dependsOn] ?? "")) : field.options
    if (options && options.length > 0) {
      return (
        <select value={String(raw ?? options[0].value)} disabled={disabled} onChange={(event) => setField(field.id, event.target.value)} aria-label={field.name} className={SELECT_CLASS}>
          {options.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
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
          disabled={disabled}
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
          disabled={disabled}
          onChange={(event) => setField(field.id, event.target.value)}
          aria-label={field.name}
          className="rounded-xl border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-highest)] font-mono text-xs text-[var(--md-sys-color-on-surface)]"
        />
      )
    }
    return <Input value={String(raw ?? "")} disabled={disabled} onChange={(event) => setField(field.id, event.target.value)} aria-label={field.name} className="rounded-xl" />
  }

  if (fields.length === 0 && ports.length <= 1) {
    return <p className="text-sm text-[var(--md-sys-color-on-surface-variant)]">{t("noConfig")}</p>
  }

  return (
    <div className={columns === 2 ? "grid gap-x-4 gap-y-3 sm:grid-cols-2" : "space-y-4"}>
      {fields.map((field) => (
        <div key={field.id} className={`space-y-1.5 ${field.multiline && columns === 2 ? "sm:col-span-2" : ""}`}>
          <Label className="text-xs text-[var(--md-sys-color-on-surface-variant)]">{field.name}</Label>
          <div>{renderField(field)}</div>
        </div>
      ))}
      {ports.length > 1 && (
        <div className="space-y-1.5">
          <Label className="text-xs text-[var(--md-sys-color-on-surface-variant)]">{t("outputPortLabel")}</Label>
          <select
            value={draft.outputPort || (ports[0]?.id ?? "")}
            disabled={disabled}
            onChange={(event) => onChange({ ...draft, outputPort: event.target.value })}
            aria-label={t("outputPortLabel")}
            className={SELECT_CLASS}
          >
            {ports.map((port) => (
              <option key={port.id} value={port.id}>{port.name}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}
