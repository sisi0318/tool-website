import type { Metadata } from "next"
import { WifiOff } from "lucide-react"

export const metadata: Metadata = {
  title: "离线",
}

// PWA 离线回退页：断网访问未缓存路由时由 Service Worker 展示
export default function OfflinePage() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-3xl bg-[var(--md-sys-color-surface-container-low)] p-8 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--md-sys-color-secondary-container)]">
          <WifiOff className="h-7 w-7 text-[var(--md-sys-color-on-secondary-container)]" />
        </div>
        <h1 className="mt-5 text-xl font-semibold text-[var(--md-sys-color-on-surface)]">
          当前处于离线状态
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-[var(--md-sys-color-on-surface-variant)]">
          这个页面还没有被缓存。恢复网络连接后刷新即可继续使用；已经打开过的工具通常可以离线使用。
        </p>
        <p className="mt-2 text-sm leading-relaxed text-[var(--md-sys-color-on-surface-variant)]">
          You are offline. Reconnect and refresh to continue — previously visited tools usually keep working offline.
        </p>
      </div>
    </div>
  )
}
