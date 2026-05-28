interface StringEditorProps {
  value: string
  disabled: boolean
  onChange: (value: string) => void
}

export function StringEditor({ value, disabled, onChange }: StringEditorProps) {
  return (
    <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-700" data-testid="inline-editor-string">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="Enter text..."
        data-testid="string-input"
        className="w-full px-2 py-1 text-xs bg-gray-50 dark:bg-gray-900 rounded 
                   border border-gray-300 dark:border-gray-600
                   disabled:opacity-50 disabled:cursor-not-allowed
                   focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
    </div>
  )
}
