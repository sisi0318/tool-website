import { useEffect } from "react"
import type { ConfigField } from "@/lib/canvas/types"
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
  // 处理联动选项 - 用于显示/隐藏和动态选项
  let dynamicOpts: Array<{ label: string; value: string }> | null = null
  if (field.dependsOn && field.dynamicOptions) {
    const dependentValue = allConfig[field.dependsOn]
    dynamicOpts = field.dynamicOptions(String(dependentValue ?? ""))
    if (dynamicOpts.length === 0) return null

    // 如果当前值不在动态选项中，自动更新为第一个选项
    const currentValue = String(value ?? field.defaultValue ?? "")
    const valueExists = dynamicOpts.some(opt => opt.value === currentValue)
    if (!valueExists && dynamicOpts.length > 0) {
      useEffect(() => {
        onChange(dynamicOpts![0].value)
      }, [dependentValue])
      return null
    }
  }

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
        value={String(value ?? field.defaultValue ?? "")}
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
        className="w-full px-1 py-0.5 text-[10px] bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700 disabled:opacity-50"
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
        className="w-full px-1 py-0.5 text-[10px] font-mono bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700 resize-y disabled:opacity-50"
      />
    )
  }

  // bytes → 文件上传
  if (field.dataType === "bytes") {
    return (
      <input
        type="file"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        disabled={disabled}
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
      className="w-full px-1 py-0.5 text-[10px] bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700 disabled:opacity-50"
    />
  )
}
