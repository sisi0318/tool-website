"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useTranslations } from "@/hooks/use-translations"

interface SaveDialogProps {
  onSave: (name: string) => void
  onCancel: () => void
  existingNames: string[]
}

export function SaveDialog({ onSave, onCancel, existingNames }: SaveDialogProps) {
  const t = useTranslations("canvas")
  const [name, setName] = useState("")
  const [showOverwrite, setShowOverwrite] = useState(false)
  const [error, setError] = useState("")

  const handleSave = () => {
    if (!name.trim()) {
      setError(t("nameRequired"))
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
          <h3 className="text-sm font-semibold mb-2">{t("workflowExistsTitle")}</h3>
          <p className="text-xs text-gray-500 mb-4">
            {t("workflowExistsMessage").replace("{name}", name)}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onCancel}>{t("cancel")}</Button>
            <Button size="sm" onClick={handleOverwrite}>{t("overwrite")}</Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 w-80">
        <h3 className="text-sm font-semibold mb-2">{t("saveWorkflow")}</h3>
        <input
          type="text"
          value={name}
          onChange={(e) => { setName(e.target.value); setError("") }}
          placeholder={t("saveWorkflowPlaceholder")}
          className="w-full px-3 py-2 text-sm border rounded-md mb-2 dark:bg-gray-900 dark:border-gray-700"
          autoFocus
        />
        {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>{t("cancel")}</Button>
          <Button size="sm" onClick={handleSave}>{t("confirm")}</Button>
        </div>
      </div>
    </div>
  )
}
