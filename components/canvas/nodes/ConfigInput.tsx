import { useEffect, useRef } from "react"
import type { ConfigField } from "@/lib/canvas/types"
import { useTranslations } from "@/hooks/use-translations"
import { SelectInput } from "./SelectInput"
import { SliderInput } from "./SliderInput"
import { SwitchInput } from "./SwitchInput"
import { ColorInput } from "./ColorInput"

interface ConfigInputProps {
  field: ConfigField
  value: unknown
  onChange: (value: unknown) => void
  disabled: boolean
  allConfig: Record<string, unknown>
}

export function ConfigInput({ field, value, onChange, disabled, allConfig }: ConfigInputProps) {
  const t = useTranslations("canvas")
  const dependentValue = field.dependsOn ? allConfig[field.dependsOn] : undefined
  const dynamicOpts = field.dependsOn && field.dynamicOptions
    ? field.dynamicOptions(String(dependentValue ?? ""))
    : null

  const currentValue = String(value ?? field.defaultValue ?? "")
  const needsAutoUpdate = dynamicOpts && dynamicOpts.length > 0 && !dynamicOpts.some(opt => opt.value === currentValue)
  const effectiveValue = needsAutoUpdate && dynamicOpts ? dynamicOpts[0].value : currentValue
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    if (needsAutoUpdate && dynamicOpts) {
      onChangeRef.current(dynamicOpts[0].value)
    }
  }, [needsAutoUpdate, dependentValue])

  if (field.visible && !field.visible(allConfig)) {
    return null
  }

  if (dynamicOpts && dynamicOpts.length === 0) return null

  // boolean → 开关
  if (field.dataType === "boolean") {
    return (
      <SwitchInput
        checked={Boolean(value ?? field.defaultValue ?? false)}
        onChange={onChange}
        disabled={disabled}
      />
    )
  }

  // 颜色选择器
  if (field.color) {
    return (
      <ColorInput
        value={String(value ?? field.defaultValue ?? "#000000")}
        onChange={onChange}
        disabled={disabled}
      />
    )
  }

  // 有 dynamicOptions → 动态下拉单选
  if (dynamicOpts) {
    return (
      <SelectInput
        options={dynamicOpts}
        value={effectiveValue}
        onChange={onChange}
        disabled={disabled}
      />
    )
  }

  // 有 options → 下拉单选
  if (field.options) {
    return (
      <SelectInput
        options={field.options}
        value={String(value ?? field.defaultValue ?? "")}
        onChange={onChange}
        disabled={disabled}
      />
    )
  }

  // number + slider → 滑块
  if (field.dataType === "number" && field.slider) {
    return (
      <SliderInput
        min={field.slider.min}
        max={field.slider.max}
        step={field.slider.step}
        value={Number(value ?? field.defaultValue ?? 0)}
        onChange={onChange}
        disabled={disabled}
      />
    )
  }

  // number → 数字输入
  if (field.dataType === "number") {
    return (
      <input
        type="number"
        value={Number(value ?? field.defaultValue ?? 0)}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        aria-label={field.name}
        className="w-full rounded-[var(--md-sys-shape-corner-extra-small)] border border-md-outline-variant bg-md-surface-container-lowest px-1.5 py-1 text-[10px] text-md-on-surface outline-none focus-visible:ring-1 focus-visible:ring-md-primary disabled:opacity-50"
      />
    )
  }

  // multiline → 多行文本
  if (field.multiline) {
    return (
      <textarea
        value={String(value ?? field.defaultValue ?? "")}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        rows={2}
        aria-label={field.name}
        className="w-full resize-y rounded-[var(--md-sys-shape-corner-extra-small)] border border-md-outline-variant bg-md-surface-container-lowest px-1.5 py-1 font-mono text-[10px] text-md-on-surface outline-none focus-visible:ring-1 focus-visible:ring-md-primary disabled:opacity-50"
      />
    )
  }

  // bytes → 文件上传
  if (field.dataType === "bytes") {
    const MAX_FILE_SIZE = 50 * 1024 * 1024
    return (
      <input
        type="file"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file && file.size > MAX_FILE_SIZE) {
            alert(t("fileTooLarge").replace("{size}", (file.size / 1024 / 1024).toFixed(1)))
            e.target.value = ""
            return
          }
          onChange(file ?? null)
        }}
        disabled={disabled}
        aria-label={field.name}
        className="w-full text-[10px] disabled:opacity-50"
      />
    )
  }

  // string → 文本输入
  return (
    <input
      type="text"
      value={String(value ?? field.defaultValue ?? "")}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      aria-label={field.name}
      className="w-full rounded-[var(--md-sys-shape-corner-extra-small)] border border-md-outline-variant bg-md-surface-container-lowest px-1.5 py-1 text-[10px] text-md-on-surface outline-none focus-visible:ring-1 focus-visible:ring-md-primary disabled:opacity-50"
    />
  )
}
