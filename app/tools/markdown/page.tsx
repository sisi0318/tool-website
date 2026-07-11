"use client"

import { useEffect, useState } from "react"
import { FileText } from "lucide-react"

import { UtilityWorkbench } from "@/components/tools/utility-workbench"
import { useTranslations } from "@/hooks/use-translations"
import { processMarkdown, type MarkdownOperation } from "@/lib/markdown-tools"

const SAMPLE = `# Release notes

## Highlights

- Faster workflows
- Safer previews
- **Copy-ready** output

> Paste Markdown on the left and choose the result you need.`

export default function MarkdownPage() {
  const t = useTranslations("markdownTools")
  const [input, setInput] = useState("")
  const [output, setOutput] = useState("")
  const [operation, setOperation] = useState<MarkdownOperation>("to-html")
  const [error, setError] = useState("")
  const [safePreview, setSafePreview] = useState("")

  useEffect(() => {
    let active = true
    void import("dompurify").then(({ default: purifier }) => {
      if (active) setSafePreview(purifier.sanitize(output))
    })
    return () => { active = false }
  }, [output])

  const run = () => {
    try {
      setOutput(processMarkdown(input, operation))
      setError("")
    } catch (cause) {
      setOutput("")
      setError(cause instanceof Error ? cause.message : t("failed"))
    }
  }

  return (
    <UtilityWorkbench
      title={t("title")}
      description={t("description")}
      icon={<FileText className="h-6 w-6" />}
      input={input}
      output={output}
      operation={operation}
      operations={[
        { value: "to-html", label: t("toHtml") },
        { value: "toc", label: t("toc") },
        { value: "plain-text", label: t("plainText") },
      ]}
      onInputChange={setInput}
      onOperationChange={(value) => { setOperation(value as MarkdownOperation); setOutput("") }}
      onRun={run}
      onClear={() => { setInput(""); setOutput(""); setError("") }}
      onSample={() => { setInput(SAMPLE); setOutput("") }}
      error={error}
      inputLabel="Markdown"
      inputPlaceholder={t("placeholder")}
      result={operation === "to-html" && output ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-[var(--md-sys-color-on-surface-variant)]">
            <span>{t("preview")}</span>
            <span>{t("sanitized")}</span>
          </div>
          <article
            className="min-h-64 overflow-auto rounded-2xl bg-[var(--md-sys-color-surface-container-low)] p-4 text-[var(--md-sys-color-on-surface)] sm:min-h-[26rem] sm:p-5 [&_a]:text-[var(--md-sys-color-primary)] [&_blockquote]:border-l-4 [&_blockquote]:border-[var(--md-sys-color-outline-variant)] [&_blockquote]:pl-4 [&_code]:rounded [&_code]:bg-[var(--md-sys-color-surface-container-high)] [&_code]:px-1 [&_h1]:mb-4 [&_h1]:text-3xl [&_h1]:font-bold [&_h2]:mb-3 [&_h2]:mt-5 [&_h2]:text-2xl [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_p]:my-3"
            dangerouslySetInnerHTML={{ __html: safePreview }}
          />
          <details className="rounded-2xl border border-[var(--md-sys-color-outline-variant)] p-4">
            <summary className="cursor-pointer font-medium">{t("htmlSource")}</summary>
            <pre className="mt-3 overflow-auto whitespace-pre-wrap break-all text-xs">{output}</pre>
          </details>
        </div>
      ) : undefined}
    />
  )
}
