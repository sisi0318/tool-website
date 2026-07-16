interface SelectInputProps {
  options: Array<{ label: string; value: string }>
  value: string
  onChange: (value: string) => void
  disabled: boolean
}

export function SelectInput({ options, value, onChange, disabled }: SelectInputProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      data-testid="select-input"
      className="w-full rounded-[var(--md-sys-shape-corner-extra-small)] border border-md-outline-variant bg-md-surface-container-lowest px-2 py-1 text-xs text-md-on-surface outline-none focus-visible:ring-1 focus-visible:ring-md-primary disabled:cursor-not-allowed disabled:opacity-50"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  )
}
