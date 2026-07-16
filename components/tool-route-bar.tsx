"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ArrowLeft, Check, Clipboard, ExternalLink, Search } from "lucide-react"

import { useTranslations } from "@/hooks/use-translations"

const toolTranslationKeys: Record<string, string> = {
  "base-converter": "baseConverter.name",
  bmi: "bmi.name",
  "case-converter": "caseConverter.name",
  "classic-cipher": "classicCipher.name",
  color: "color.name",
  compression: "compression.name",
  crontab: "crontab.name",
  crypto: "crypto.name",
  currency: "currency.name",
  device: "device.name",
  "data-detector": "dataDetector.name",
  diff: "diff.name",
  "docker-converter": "dockerConverter.name",
  encoding: "encoding.name",
  "exif-viewer": "exifViewer.name",
  hash: "hash.name",
  hmac: "hmac.name",
  "http-tester": "httpTester.name",
  "image-compress": "imageCompress.name",
  "image-convert": "imageConvert.name",
  "image-coordinates": "imageCoordinates.name",
  "image-editor": "imageEditor.name",
  "image-to-base64": "imageToBase64.name",
  jce: "jce.name",
  json: "json.name",
  jwt: "jwt.name",
  "meme-splitter": "memeSplitter.name",
  "office-viewer": "officeViewer.name",
  "password-generator": "passwordGenerator.name",
  protobuf: "protobuf.name",
  qrcode: "qrcode.name",
  "qrcode-decode": "qrcodeDecoder.name",
  regex: "regex.name",
  "temperature-converter": "temperatureConverter.name",
  "text-stats": "textStats.name",
  time: "time.name",
  totp: "totp.name",
  uuid: "uuid.name",
  whois: "whois.name",
  xml: "xmlTools.name",
  csv: "csvTools.name",
  markdown: "markdownTools.name",
  sql: "sqlTools.name",
  "json-schema": "jsonSchemaTools.name",
  subnet: "subnetTools.name",
  certificate: "certificateTools.name",
  "hex-binary": "hexBinaryTools.name",
}

const workspaceTools = new Set([
  "base-converter", "bmi", "case-converter", "classic-cipher", "color", "crontab",
  "crypto", "currency", "device", "diff", "docker-converter", "encoding", "exif-viewer",
  "hash", "hmac", "http-tester", "image-compress", "image-convert", "image-coordinates", "image-editor",
  "image-to-base64", "jce", "json", "jwt", "meme-splitter", "office-viewer",
  "protobuf", "qrcode", "qrcode-decode", "regex", "temperature-converter", "text-stats",
  "time", "totp", "uuid", "whois", "password-generator", "data-detector", "compression",
  "xml", "csv", "markdown", "sql", "json-schema", "subnet", "certificate", "hex-binary",
])

export function ToolRouteBar() {
  const pathname = usePathname()
  const commonT = useTranslations("common")
  const toolsT = useTranslations("tools")
  const [copied, setCopied] = useState(false)
  const toolId = pathname.split("/")[2] || ""
  const translationKey = toolTranslationKeys[toolId]
  const toolName = translationKey ? toolsT(translationKey) : ""

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (target?.matches("input, textarea, select, [contenteditable='true']")) return
      const firstField = document.querySelector<HTMLElement>(
        "main input:not([type='hidden']):not([aria-hidden='true']):not([disabled]), main textarea:not([aria-hidden='true']):not([disabled]), main select:not([aria-hidden='true']):not([disabled])",
      )
      if (!firstField) return
      event.preventDefault()
      firstField.focus()
    }

    window.addEventListener("keydown", handleShortcut)
    return () => {
      window.removeEventListener("keydown", handleShortcut)
    }
  }, [pathname])

  const workspaceUrl = workspaceTools.has(toolId) ? `/tools?tool=${encodeURIComponent(toolId)}` : null

  if (!translationKey) return null

  const copyLink = async () => {
    await navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div className="sticky top-16 z-40 border-b border-[var(--md-sys-color-outline-variant)]/60 bg-[var(--md-sys-color-surface)]/92 backdrop-blur-xl">
      <div className="container mx-auto flex min-h-12 max-w-7xl items-center gap-1 px-2 sm:min-h-14 sm:gap-2 sm:px-6 lg:px-8">
        <Link
          href="/tools"
          aria-label={commonT("backToTools")}
          className="inline-flex min-h-10 min-w-10 items-center justify-center gap-2 rounded-full px-2 text-sm font-semibold text-[var(--md-sys-color-on-surface-variant)] hover:bg-[var(--md-sys-color-surface-container-high)] hover:text-[var(--md-sys-color-on-surface)] sm:min-w-0 sm:justify-start sm:px-3"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">{commonT("backToTools")}</span>
        </Link>

        <span className="mx-1 hidden h-5 w-px bg-[var(--md-sys-color-outline-variant)] sm:block" />
        <strong className="min-w-0 flex-1 truncate text-xs text-[var(--md-sys-color-on-surface)] sm:text-sm">
          {toolName}
        </strong>

        <span className="hidden items-center gap-1.5 text-xs text-[var(--md-sys-color-on-surface-variant)] lg:inline-flex">
          <Search className="h-3.5 w-3.5" />
          {commonT("focusInputHint")}
        </span>

        <button
          type="button"
          onClick={copyLink}
          aria-label={copied ? commonT("linkCopied") : commonT("copyToolLink")}
          className="inline-flex min-h-10 min-w-10 items-center justify-center gap-2 rounded-full px-2 text-sm font-semibold text-[var(--md-sys-color-on-surface-variant)] hover:bg-[var(--md-sys-color-surface-container-high)] md:min-w-0 md:px-3"
        >
          {copied ? <Check className="h-4 w-4 text-[var(--md-sys-color-primary)]" /> : <Clipboard className="h-4 w-4" />}
          <span className="hidden md:inline">{copied ? commonT("linkCopied") : commonT("copyToolLink")}</span>
        </button>

        {workspaceUrl && (
          <Link
            href={workspaceUrl}
            aria-label={commonT("openInWorkspace")}
            className="inline-flex min-h-10 min-w-10 items-center justify-center gap-2 rounded-full bg-[var(--md-sys-color-secondary-container)] px-2 text-sm font-bold text-[var(--md-sys-color-on-secondary-container)] hover:brightness-95 sm:min-w-0 sm:px-3"
          >
            <ExternalLink className="h-4 w-4" />
            <span className="hidden sm:inline">{commonT("openInWorkspace")}</span>
          </Link>
        )}
      </div>
    </div>
  )
}
