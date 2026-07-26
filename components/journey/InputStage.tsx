"use client"

import { useRef, useState, type ChangeEvent, type DragEvent } from "react"
import { Braces, FileKey2, FileText, Import, LoaderCircle, Sparkles, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useTranslations } from "@/hooks/use-translations"

/** Classic decodable sample token (jwt.io demo token, HS256). */
const SAMPLE_JWT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." +
  "eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ." +
  "SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
/** base64("Hello, 数据旅程! 一起探索数据的形状。") — UTF-8, decodes to a short sentence. */
const SAMPLE_BASE64 = "SGVsbG8sIOaVsOaNruaXheeoiyEg5LiA6LW35o6i57Si5pWw5o2u55qE5b2i54q244CC"
const SAMPLE_JSON = '{"user":{"name":"Ada","roles":["dev","admin"]},"iat":1716239022,"active":true}'

const EXAMPLES = [
  { key: "exampleJwt", icon: FileKey2, value: SAMPLE_JWT },
  { key: "exampleBase64", icon: FileText, value: SAMPLE_BASE64 },
  { key: "exampleJson", icon: Braces, value: SAMPLE_JSON },
] as const

interface InputStageProps {
  /** Steps waiting from an imported share link, or null when there is none. */
  pendingStepCount: number | null
  /** True while an imported path is being replayed against the provided data. */
  starting: boolean
  onStart: (value: unknown) => void
}

export function InputStage({ pendingStepCount, starting, onStart }: InputStageProps) {
  const t = useTranslations("journey")
  const [text, setText] = useState("")
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (file) onStart(file)
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragOver(false)
    if (starting) return
    const file = event.dataTransfer.files?.[0]
    if (file) onStart(file)
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-10">
      <div
        onDragOver={(event) => {
          event.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`w-full max-w-xl rounded-3xl bg-[var(--md-sys-color-surface-container-low)] p-6 shadow-sm transition-shadow sm:p-8 ${
          dragOver ? "ring-2 ring-[var(--md-sys-color-primary)]" : ""
        }`}
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--md-sys-color-primary-container)]">
          <Sparkles className="h-6 w-6 text-[var(--md-sys-color-on-primary-container)]" />
        </div>
        <h1 className="mt-4 text-center text-2xl font-semibold text-[var(--md-sys-color-on-surface)]">
          {t("inputTitle")}
        </h1>
        <p className="mt-2 text-center text-sm leading-relaxed text-[var(--md-sys-color-on-surface-variant)]">
          {t("description")}
        </p>

        {pendingStepCount !== null && (
          <div className="mt-4 flex items-start gap-2 rounded-2xl bg-[var(--md-sys-color-tertiary-container)] p-3 text-sm leading-relaxed text-[var(--md-sys-color-on-tertiary-container)]">
            <Import className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>{t("importedFromLink").replace("{count}", String(pendingStepCount))}</span>
          </div>
        )}

        <Textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={t("inputPlaceholder")}
          aria-label={t("inputTitle")}
          rows={6}
          className="mt-5 min-h-36 rounded-2xl border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-highest)] font-mono text-sm text-[var(--md-sys-color-on-surface)] placeholder:text-[var(--md-sys-color-on-surface-variant)]/60 focus-visible:ring-[var(--md-sys-color-primary)]"
        />

        <div className="mt-4 flex flex-col justify-center gap-3 sm:flex-row">
          <Button
            onClick={() => onStart(text)}
            disabled={!text.trim() || starting}
            className="rounded-full bg-[var(--md-sys-color-primary)] px-6 text-[var(--md-sys-color-on-primary)] hover:bg-[var(--md-sys-color-primary)]/90"
          >
            {starting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {starting ? t("applying") : t("startExploring")}
          </Button>
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={starting}
            className="rounded-full border-[var(--md-sys-color-outline-variant)] px-6"
          >
            <Upload className="h-4 w-4" />
            {t("uploadFile")}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileChange}
            aria-label={t("uploadFile")}
            className="hidden"
          />
        </div>
        <p className="mt-2 text-center text-xs text-[var(--md-sys-color-on-surface-variant)]">{t("orDrop")}</p>

        <div className="mt-5 border-t border-[var(--md-sys-color-outline-variant)] pt-4">
          <p className="text-xs font-medium text-[var(--md-sys-color-on-surface-variant)]">{t("tryExample")}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {EXAMPLES.map((example) => {
              const Icon = example.icon
              return (
                <button
                  key={example.key}
                  type="button"
                  onClick={() => onStart(example.value)}
                  disabled={starting}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--md-sys-color-outline-variant)] px-3 py-1.5 text-sm text-[var(--md-sys-color-on-surface-variant)] transition-colors hover:bg-[var(--md-sys-color-secondary-container)] hover:text-[var(--md-sys-color-on-secondary-container)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--md-sys-color-primary)] disabled:opacity-50"
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                  {t(example.key)}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
