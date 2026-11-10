"use client"

import { useEffect, useRef, useState } from "react"
import { AlertTriangle, LoaderCircle, RotateCw } from "lucide-react"
import { getNodeDefinition } from "@/lib/canvas/registry"
import type { NodeDefinition } from "@/lib/canvas/types"
import type { JourneyStep } from "@/lib/journey/types"
import { Button } from "@/components/ui/button"
import { useTranslations } from "@/hooks/use-translations"
import { zhJourney } from "@/lib/translations/zh-namespaces/journey"
import { StepConfigForm, draftOf, hasStepSettings, type StepDraft } from "./StepConfigForm"

/** 停手多久之后才重算：够把一个词打完，又不至于觉得没反应 */
export const LIVE_RERUN_DELAY_MS = 350
/** 上游文本超过这个长度就不边改边算了：每敲一个字重算一次会卡 */
const LIVE_INPUT_CHARS = 200_000

/**
 * 这一步能不能边改参数边算。会联网的、要人确认的、适配器自己声明很慢的（OCR 这类会放宽超时）、
 * 以及处理文件的，都改成点“重新运行”才算。
 */
export function canRerunLive(definition: NodeDefinition | undefined, input: unknown): boolean {
  if (!definition || definition.network || definition.executionMode === "manual" || definition.executionTimeoutMs) return false
  if (typeof Blob !== "undefined" && input instanceof Blob) return false
  return !(typeof input === "string" && input.length > LIVE_INPUT_CHARS)
}

export type StepSettingsResult = { status: "applied" } | { status: "failed"; message: string } | { status: "skipped" }

interface StepSettingsProps {
  step: JourneyStep
  /** 这一步的输入，也就是上一步的结果；用来判断能不能边改边算 */
  input: unknown
  /** 有别的运行锁着界面（不含这里触发的即时重算） */
  busy: boolean
  onChange: (config: Record<string, unknown>, outputPort: string, options: { live: boolean }) => Promise<StepSettingsResult>
}

/**
 * 详情区里就地改一步的参数。以前要点开一个弹层，弹层盖住了正在看的结果，改一次关一次才知道对不对。
 *
 * 表单里的值以用户输入为准：一次重算还没回来时又改了，不会被旧结果冲掉。
 * 所以用的地方要给它 key={节点 id}，换一步看时才重新读那一步的参数。
 */
export function StepSettings({ step, input, busy, onChange }: StepSettingsProps) {
  const t = useTranslations("journey", zhJourney)
  const [draft, setDraft] = useState<StepDraft>(() => draftOf(step))
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const live = canRerunLive(getNodeDefinition(step.tool), input)

  const latest = useRef({ draft, onChange })
  latest.current = { draft, onChange }
  const timer = useRef<number | null>(null)
  const requested = useRef(0)

  const submit = async (next: StepDraft, options: { live: boolean }) => {
    const ticket = ++requested.current
    setPending(true)
    const result = await latest.current.onChange(next.config, next.outputPort, options)
    // 这期间又改了：结果归更新的那一次管
    if (ticket !== requested.current) return
    setPending(false)
    if (result.status === "applied") setError(null)
    else if (result.status === "failed") setError(result.message)
  }

  const edit = (next: StepDraft) => {
    setDraft(next)
    if (!live) return
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      timer.current = null
      void submit(next, { live: true })
    }, LIVE_RERUN_DELAY_MS)
  }

  // 改完立刻去看别的步骤时，还在等的那次改动照样交出去，不悄悄丢掉
  useEffect(() => () => {
    if (timer.current === null) return
    window.clearTimeout(timer.current)
    const { draft: last, onChange: send } = latest.current
    void send(last.config, last.outputPort, { live: true })
  }, [])

  if (!hasStepSettings(step)) return null

  return (
    <section aria-label={t("stepSettings")} className="rounded-3xl bg-[var(--md-sys-color-surface-container-low)] p-4 shadow-sm sm:p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="text-xs font-medium uppercase tracking-wide text-[var(--md-sys-color-on-surface-variant)]">{t("stepSettings")}</h3>
        {live ? (
          <span className="inline-flex items-center gap-1 text-xs text-[var(--md-sys-color-on-surface-variant)]">
            {pending && <LoaderCircle className="h-3.5 w-3.5 animate-spin text-[var(--md-sys-color-primary)]" aria-hidden />}
            {t("stepSettingsLive")}
          </span>
        ) : (
          <Button
            size="sm"
            onClick={() => void submit(draft, { live: false })}
            disabled={busy || pending}
            className="ml-auto rounded-full bg-[var(--md-sys-color-primary)] px-4 text-[var(--md-sys-color-on-primary)] hover:bg-md-primary/90"
          >
            {pending ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <RotateCw className="h-3.5 w-3.5" aria-hidden />}
            {t("rerunStep")}
          </Button>
        )}
      </div>

      <StepConfigForm tool={step.tool} draft={draft} onChange={edit} disabled={busy} columns={2} />

      {error !== null && (
        <div role="alert" className="mt-3 rounded-2xl bg-[var(--md-sys-color-error-container)] p-3 text-sm text-[var(--md-sys-color-on-error-container)]">
          <p className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
            {t("stepErrorTitle")}
          </p>
          <p className="mt-1 break-words font-mono text-xs">{error}</p>
          <p className="mt-1 text-xs">{t("stepErrorKept")}</p>
        </div>
      )}
    </section>
  )
}
