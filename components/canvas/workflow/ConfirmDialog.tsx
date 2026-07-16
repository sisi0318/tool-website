"use client"

import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog"
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
    <AlertDialogPrimitive.Root open>
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[var(--md-sys-color-scrim)]/50" />
        <AlertDialogPrimitive.Content
          onEscapeKeyDown={onCancel}
          className="fixed left-1/2 top-1/2 z-[51] w-80 max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-[var(--md-sys-shape-corner-large)] border border-md-outline-variant bg-md-surface-container-high p-4 text-md-on-surface shadow-2xl outline-none"
        >
          <AlertDialogPrimitive.Title className="mb-2 text-sm font-semibold">
            {title}
          </AlertDialogPrimitive.Title>
          <AlertDialogPrimitive.Description className="mb-4 text-xs text-md-on-surface-variant">
            {message}
          </AlertDialogPrimitive.Description>
          <div className="flex justify-end gap-2">
            <AlertDialogPrimitive.Cancel asChild>
              <Button type="button" variant="outline" size="sm" onClick={onCancel} className="min-h-11 sm:min-h-9">
                {t("cancel")}
              </Button>
            </AlertDialogPrimitive.Cancel>
            <AlertDialogPrimitive.Action asChild>
              <Button type="button" size="sm" onClick={onConfirm} className="min-h-11 sm:min-h-9">
                {confirmLabel ?? t("confirm")}
              </Button>
            </AlertDialogPrimitive.Action>
          </div>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  )
}
