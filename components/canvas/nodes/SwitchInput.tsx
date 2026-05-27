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
      <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" />
    </label>
  )
}
