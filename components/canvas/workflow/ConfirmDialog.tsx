"use client"

import { Button } from "@/components/ui/button"
import { useTranslations } from "@/hooks/use-translations"

interface ConfirmDialogProps {
  title: string
  message: string
  onConfirm: () => void
  onCancel: () => void
  confirmLabel?: string
}

export function ConfirmDialog({ title, message, onConfirm, onCancel, confirmLabel }: ConfirmDialogProps) {
  const t = useTranslations("canvas")

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 w-80">
        <h3 className="text-sm font-semibold mb-2">{title}</h3>
        <p className="text-xs text-gray-500 mb-4">{message}</p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>{t("cancel")}</Button>
          <Button size="sm" onClick={onConfirm}>{confirmLabel ?? t("confirm")}</Button>
        </div>
      </div>
    </div>
  )
}
