"use client"

import { useCallback, useSyncExternalStore } from "react"

/**
 * 视口是否满足一条媒体查询。只在结果翻转时重新渲染，不像监听 resize 那样每个像素都触发。
 * 服务端渲染和不支持 matchMedia 的环境（jsdom）一律当作不满足，所以写查询时让“不满足”对应窄屏布局。
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (notify: () => void) => {
      if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {}
      const list = window.matchMedia(query)
      list.addEventListener("change", notify)
      return () => list.removeEventListener("change", notify)
    },
    [query],
  )
  return useSyncExternalStore(
    subscribe,
    () => (typeof window.matchMedia === "function" ? window.matchMedia(query).matches : false),
    () => false,
  )
}
