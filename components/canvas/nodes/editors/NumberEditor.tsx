interface NumberEditorProps {
  value: number
  disabled: boolean
  onChange: (value: number) => void
}

export function NumberEditor({ value, disabled, onChange }: NumberEditorProps) {
  return (
    <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-700" data-testid="inline-editor-number">
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        data-testid="number-input"
        className="w-full px-2 py-1 text-xs bg-gray-50 dark:bg-gray-900 rounded 
                   border border-gray-300 dark:border-gray-600
                   disabled:opacity-50 disabled:cursor-not-allowed
                   focus:outline-none focus:ring-1 focus:ring-green-500"
      />
    </div>
  )
}
