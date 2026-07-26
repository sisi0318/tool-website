"use client"

import { useEffect } from "react"
import Link from "next/link"
import { AlertTriangle, Home, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTranslations } from "@/hooks/use-translations"

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const t = useTranslations("common")

  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-3xl bg-[var(--md-sys-color-surface-container-low)] p-8 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--md-sys-color-error-container)]">
          <AlertTriangle className="h-7 w-7 text-[var(--md-sys-color-on-error-container)]" />
        </div>
        <h1 className="mt-5 text-xl font-semibold text-[var(--md-sys-color-on-surface)]">
          {t("errorTitle")}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-[var(--md-sys-color-on-surface-variant)]">
          {t("errorDescription")}
        </p>
        {error.digest && (
          <p className="mt-2 text-xs text-[var(--md-sys-color-on-surface-variant)]/70">
            digest: {error.digest}
          </p>
        )}
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Button
            onClick={reset}
            className="rounded-full bg-[var(--md-sys-color-primary)] px-6 text-[var(--md-sys-color-on-primary)] hover:bg-[var(--md-sys-color-primary)]/90"
          >
            <RotateCcw className="h-4 w-4" />
            {t("errorRetry")}
          </Button>
          <Button
            asChild
            variant="outline"
            className="rounded-full border-[var(--md-sys-color-outline-variant)] px-6"
          >
            <Link href="/">
              <Home className="h-4 w-4" />
              {t("errorBackHome")}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
