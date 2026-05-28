"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"

interface SaveDialogProps {
  onSave: (name: string) => void
  onCancel: () => void
  existingNames: string[]
}

export function SaveDialog({ onSave, onCancel, existingNames }: SaveDialogProps) {
  const [name, setName] = useState("")
  const [showOverwrite, setShowOverwrite] = useState(false)
  const [error, setError] = useState("")

  const handleSave = () => {
    if (!name.trim()) {
      setError("请输入名字")
      return
    }
    if (existingNames.includes(name.trim())) {
      setShowOverwrite(true)
      return
    }
    onSave(name.trim())
  }

  const handleOverwrite = () => {
    onSave(name.trim())
  }

  if (showOverwrite) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 w-80">
          <h3 className="text-sm font-semibold mb-2">工作流已存在</h3>
          <p className="text-xs text-gray-500 mb-4">
            名为「{name}」的工作流已存在，是否覆盖？
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onCancel}>取消</Button>
            <Button size="sm" onClick={handleOverwrite}>覆盖</Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 w-80">
        <h3 className="text-sm font-semibold mb-2">保存工作流</h3>
        <input
          type="text"
          value={name}
          onChange={(e) => { setName(e.target.value); setError("") }}
          placeholder="输入工作流名字"
          className="w-full px-3 py-2 text-sm border rounded-md mb-2 dark:bg-gray-900 dark:border-gray-700"
          autoFocus
        />
        {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>取消</Button>
          <Button size="sm" onClick={handleSave}>确认</Button>
        </div>
      </div>
    </div>
  )
}
