interface JsonEditorProps {
  value: string
  disabled: boolean
  onChange: (value: string) => void
}

export function JsonEditor({ value, disabled, onChange }: JsonEditorProps) {
  return (
    <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-700" data-testid="inline-editor-json">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        rows={4}
        placeholder='{"key": "value"}'
        data-testid="json-textarea"
        className="w-full px-2 py-1 text-xs font-mono 
                   bg-gray-50 dark:bg-gray-900 rounded 
                   border border-gray-300 dark:border-gray-600
                   disabled:opacity-50 disabled:cursor-not-allowed
                   focus:outline-none focus:ring-1 focus:ring-purple-500
                   resize-y"
      />
    </div>
  )
}
