"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { BinaryFileError } from "@/lib/compression-files"
import { useTranslations } from "@/hooks/use-translations"

export function useBinaryFileTask() {
  const t = useTranslations("compressionFiles")
  const [running, setRunning] = useState(false)
  const [error, setError] = useState("")
  const [progress, setProgress] = useState("")
  const request = useRef(0)
  const controller = useRef<AbortController | null>(null)
  const cancel = useCallback(() => { request.current += 1; controller.current?.abort(); controller.current = null; setRunning(false); setProgress("") }, [])
  useEffect(() => () => { request.current += 1; controller.current?.abort() }, [])
  const run = useCallback(async <T,>(work: (signal: AbortSignal, report: (value: string) => void) => Promise<T>, commit: (value: T) => void) => {
    controller.current?.abort()
    const version = ++request.current
    const next = new AbortController()
    controller.current = next
    setRunning(true); setError(""); setProgress("")
    try {
      const value = await work(next.signal, (message) => { if (version === request.current) setProgress(message) })
      if (version === request.current && !next.signal.aborted) commit(value)
    } catch (error) {
      if (version !== request.current || next.signal.aborted) return
      setError(error instanceof BinaryFileError ? [t("errors." + error.code), error.entry, error.detail].filter(Boolean).join(" · ") : t("errors.corrupt"))
    } finally {
      if (version === request.current) { setRunning(false); setProgress(""); controller.current = null }
    }
  }, [t])
  return { running, error, progress, run, cancel, clearError: () => setError("") }
}
