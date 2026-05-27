interface ColorInputProps {
  value: string
  onChange: (value: string) => void
  disabled: boolean
}

export function ColorInput({ value, onChange, disabled }: ColorInputProps) {
  return (
    <div className="flex items-center gap-2" data-testid="color-input">
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
        className="flex-1 px-2 py-1 text-xs font-mono bg-gray-50 dark:bg-gray-900 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50"
      />
    </div>
  )
}
