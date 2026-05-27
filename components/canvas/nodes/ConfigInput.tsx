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
  // 处理联动选项
  let options = field.options
  if (field.dependsOn && field.dynamicOptions) {
    const dependentValue = allConfig[field.dependsOn]
    const dynamicOpts = field.dynamicOptions(String(dependentValue ?? ""))
    if (dynamicOpts.length === 0) return null
    options = dynamicOpts
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

  // 有 options → 下拉单选
  if (options) {
    return (
      <SelectInput
        options={options}
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
        data-testid="number-input"
        className="w-full px-2 py-1 text-xs bg-gray-50 dark:bg-gray-900 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50"
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
        rows={3}
        data-testid="textarea-input"
        className="w-full px-2 py-1 text-xs font-mono bg-gray-50 dark:bg-gray-900 rounded border border-gray-300 dark:border-gray-600 resize-y disabled:opacity-50"
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
      data-testid="text-input"
      className="w-full px-2 py-1 text-xs bg-gray-50 dark:bg-gray-900 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50"
    />
  )
}
