"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslations } from "@/hooks/use-translations"
import { PdfToolError, type PdfProgress } from "@/lib/pdf-shared"
import type { PdfTaskContext } from "@/lib/pdf-worker-client"

export function usePdfTask() {
  const t = useTranslations("pdfTools")
  const [running, setRunning] = useState(false), [error, setError] = useState(""), [progress, setProgress] = useState<PdfProgress | null>(null)
  const controller = useRef<AbortController | null>(null), version = useRef(0)
  const cancel = useCallback(() => { version.current++; controller.current?.abort(); controller.current = null; setRunning(false); setProgress(null) }, [])
  useEffect(() => () => { version.current++; controller.current?.abort() }, [])
  const run = useCallback(async <T,>(work: (context: PdfTaskContext) => Promise<T>, commit: (value: T) => void) => {
    controller.current?.abort(); const id = ++version.current, abort = new AbortController(); controller.current = abort
    setRunning(true); setError(""); setProgress(null)
    try {
      const result = await work({ signal: abort.signal, onProgress: (value) => { if (version.current === id) setProgress(value) } })
      if (version.current === id && !abort.signal.aborted) commit(result)
    } catch (cause) { if (version.current === id && !abort.signal.aborted) setError(cause instanceof PdfToolError ? [t("errors." + cause.code), cause.detail].filter(Boolean).join(" · ") : t("errors.invalidPdf")) }
    finally { if (version.current === id) { setRunning(false); setProgress(null); controller.current = null } }
  }, [t])
  return { running, error, progress, cancel, run, clearError: () => setError("") }
}
