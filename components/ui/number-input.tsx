"use client"

import * as React from "react"
import { Input } from "@/components/ui/input"

type NumberInputProps = Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "type" | "min" | "max"> & {
  value: number
  min: number
  max: number
  onValueChange: (value: number) => void
}

/**
 * 带范围的整数输入框。输入过程中允许暂时越界 —— 想输 12 时先敲出的 1 不会被立刻改成最小值 8；
 * 输入的数在范围内就立即生效，失焦或回车时再把草稿收拢到 [min, max]。
 */
export function NumberInput({ value, min, max, onValueChange, onBlur, onKeyDown, ...props }: NumberInputProps) {
  const [draft, setDraft] = React.useState(String(value))

  // 滑块等外部来源改了值时同步草稿
  React.useEffect(() => {
    setDraft(String(value))
  }, [value])

  const commit = () => {
    const parsed = Number(draft)
    const next = draft.trim() !== "" && Number.isFinite(parsed) ? Math.min(max, Math.max(min, Math.round(parsed))) : value
    setDraft(String(next))
    if (next !== value) onValueChange(next)
  }

  return (
    <Input
      {...props}
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      value={draft}
      onChange={(event) => {
        const text = event.target.value
        setDraft(text)
        const parsed = Number(text)
        if (text.trim() !== "" && Number.isInteger(parsed) && parsed >= min && parsed <= max) onValueChange(parsed)
      }}
      onBlur={(event) => {
        commit()
        onBlur?.(event)
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") commit()
        onKeyDown?.(event)
      }}
    />
  )
}
