import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import {
  createObjectUrl,
  revokeObjectUrl,
  type ObjectUrlSource,
} from "@/lib/object-url"

export function useObjectUrl(source: ObjectUrlSource | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!source) {
      setUrl(null)
      return
    }

    const nextUrl = createObjectUrl(source)
    setUrl(nextUrl)

    return () => {
      revokeObjectUrl(nextUrl)
    }
  }, [source])

  return url
}

export function useObjectUrlRegistry() {
  const urlsRef = useRef(new Set<string>())
  const activeRef = useRef(true)

  const revoke = useCallback((url: string | null | undefined) => {
    if (!url) return
    urlsRef.current.delete(url)
    revokeObjectUrl(url)
  }, [])

  const revokeAll = useCallback(() => {
    const urls = [...urlsRef.current]
    urlsRef.current.clear()
    urls.forEach(revokeObjectUrl)
  }, [])

  const create = useCallback((source: ObjectUrlSource) => {
    if (!activeRef.current) {
      throw new Error("Cannot create an Object URL after the owner unmounted")
    }

    const url = createObjectUrl(source)
    urlsRef.current.add(url)
    return url
  }, [])

  useEffect(() => {
    activeRef.current = true

    return () => {
      activeRef.current = false
      revokeAll()
    }
  }, [revokeAll])

  return useMemo(() => ({
    create,
    revoke,
    revokeAll,
  }), [create, revoke, revokeAll])
}
