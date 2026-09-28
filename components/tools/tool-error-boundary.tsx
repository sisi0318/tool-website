"use client"

import { Component, Fragment, type ReactNode } from "react"
import { AlertTriangle, ExternalLink, RotateCcw, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTranslations } from "@/hooks/use-translations"

/** 工具的代码文件没下载下来：多半是网站刚更新、旧页面还在引用旧文件，重试没用，要刷新 */
export function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return error.name === "ChunkLoadError" || /loading (css )?chunk .* failed|failed to fetch dynamically imported module|importing a module script failed/i.test(error.message)
}

function ToolErrorFallback({ error, toolTitle, standaloneHref, onRetry, onClose }: {
  error: Error
  toolTitle: string
  standaloneHref: string
  onRetry: () => void
  onClose: () => void
}) {
  const t = useTranslations("tools")
  const chunk = isChunkLoadError(error)
  return (
    <div role="alert" className="mx-auto my-8 max-w-xl space-y-4 rounded-3xl border border-[var(--md-sys-color-error)]/40 bg-[var(--md-sys-color-error-container)]/40 p-6 text-[var(--md-sys-color-on-surface)]">
      <div className="flex items-center gap-2 font-semibold">
        <AlertTriangle className="h-5 w-5 text-[var(--md-sys-color-error)]" aria-hidden="true" />
        {t("toolCrashedTitle").replace("{name}", toolTitle)}
      </div>
      <p className="text-sm text-[var(--md-sys-color-on-surface-variant)]">{t(chunk ? "toolChunkFailed" : "toolCrashedDescription")}</p>
      <div className="flex flex-wrap gap-2">
        {chunk ? (
          <Button size="sm" onClick={() => window.location.reload()}>
            <RotateCcw className="h-4 w-4" />
            {t("reloadPage")}
          </Button>
        ) : (
          <Button size="sm" onClick={onRetry}>
            <RotateCcw className="h-4 w-4" />
            {t("retryTool")}
          </Button>
        )}
        <Button size="sm" variant="outline" asChild>
          <a href={standaloneHref}>
            <ExternalLink className="h-4 w-4" />
            {t("openStandalone")}
          </a>
        </Button>
        <Button size="sm" variant="ghost" onClick={onClose}>
          <X className="h-4 w-4" />
          {t("closeTab")}
        </Button>
      </div>
    </div>
  )
}

interface ToolErrorBoundaryProps {
  toolTitle: string
  standaloneHref: string
  onClose: () => void
  children: ReactNode
}

/**
 * 工作台里每个标签各包一层。以前任何一个工具渲染出错或代码加载失败，
 * 都会被根级的 app/error.tsx 接住，整个工作台连同其它标签一起丢失。
 */
export class ToolErrorBoundary extends Component<ToolErrorBoundaryProps, { error: Error | null; attempt: number }> {
  state = { error: null as Error | null, attempt: 0 }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error(error)
  }

  private retry = () => this.setState(({ attempt }) => ({ error: null, attempt: attempt + 1 }))

  render() {
    const { error, attempt } = this.state
    if (error) {
      return <ToolErrorFallback error={error} toolTitle={this.props.toolTitle} standaloneHref={this.props.standaloneHref} onRetry={this.retry} onClose={this.props.onClose} />
    }
    // 换 key 让工具重新挂载一次，而不是沿用出错时的状态
    return <Fragment key={attempt}>{this.props.children}</Fragment>
  }
}
