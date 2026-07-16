import { useCallback } from "react"

interface ColorInputProps {
  value: string
  onChange: (value: string) => void
  disabled: boolean
}

export function ColorInput({ value, onChange, disabled }: ColorInputProps) {
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
  }, [])

  return (
    <div
      className="flex items-center gap-2"
      data-testid="color-input"
      onMouseDown={handleMouseDown}
    >
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-8 h-8 rounded cursor-pointer disabled:opacity-50"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="flex-1 rounded-[var(--md-sys-shape-corner-extra-small)] border border-md-outline-variant bg-md-surface-container-lowest px-2 py-1 font-mono text-xs text-md-on-surface outline-none focus-visible:ring-1 focus-visible:ring-md-primary disabled:opacity-50"
      />
    </div>
  )
}
