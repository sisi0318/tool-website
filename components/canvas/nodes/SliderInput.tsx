import { useCallback } from "react"

interface SliderInputProps {
  min: number
  max: number
  step: number
  value: number
  onChange: (value: number) => void
  disabled: boolean
}

export function SliderInput({ min, max, step, value, onChange, disabled }: SliderInputProps) {
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
  }, [])

  return (
    <div
      className="flex items-center gap-2"
      data-testid="slider-input"
      onMouseDown={handleMouseDown}
    >
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        className="flex-1 disabled:opacity-50"
      />
      <span className="text-xs text-gray-500 w-8 text-right">{value}</span>
    </div>
  )
}
