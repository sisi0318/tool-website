interface SwitchInputProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled: boolean
}

export function SwitchInput({ checked, onChange, disabled }: SwitchInputProps) {
  return (
    <label className="relative inline-flex items-center cursor-pointer" data-testid="switch-input">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="sr-only peer"
      />
      <div className="peer h-5 w-9 rounded-full bg-md-surface-container-highest outline-none ring-offset-1 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-md-outline after:transition-all after:content-[''] peer-checked:bg-md-primary peer-checked:after:translate-x-full peer-checked:after:bg-md-on-primary peer-focus-visible:ring-2 peer-focus-visible:ring-md-primary peer-disabled:opacity-50" />
    </label>
  )
}
