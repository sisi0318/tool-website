"use client"

import type { LucideIcon } from "lucide-react"
import Link from "next/link"
import {
  ArrowRight,
  Braces,
  Check,
  FileImage,
  Fingerprint,
  LockKeyhole,
  Search,
  ShieldCheck,
  Sparkles,
  Workflow,
  Zap,
} from "lucide-react"

import Header from "@/components/header"
import { Button } from "@/components/ui/button"
import { useTranslations } from "@/hooks/use-translations"

interface FeaturedTool {
  id: string
  translationKey: string
  descriptionKey: string
  icon: LucideIcon
  accent: string
}

const featuredTools: FeaturedTool[] = [
  {
    id: "json",
    translationKey: "json",
    descriptionKey: "featuredJson",
    icon: Braces,
    accent: "bg-[#e4f2df] text-[#2f6b2f] dark:bg-[#29432a] dark:text-[#b9dfb1]",
  },
  {
    id: "hash",
    translationKey: "hash",
    descriptionKey: "featuredHash",
    icon: Fingerprint,
    accent: "bg-[#dcefeb] text-[#006b60] dark:bg-[#17443f] dark:text-[#8bd4c9]",
  },
  {
    id: "image-compress",
    translationKey: "imageCompress",
    descriptionKey: "featuredImage",
    icon: FileImage,
    accent: "bg-[#f4ead5] text-[#765a1f] dark:bg-[#493b20] dark:text-[#e7cb8d]",
  },
  {
    id: "crypto",
    translationKey: "crypto",
    descriptionKey: "featuredCrypto",
    icon: LockKeyhole,
    accent: "bg-[#e8e5f3] text-[#5d547c] dark:bg-[#373247] dark:text-[#cbc2ea]",
  },
]

export default function HomePage() {
  const t = useTranslations("home")
  const toolsT = useTranslations("tools")

  return (
    <div className="min-h-screen overflow-hidden bg-[var(--md-sys-color-surface)]">
      <Header />

      <section className="home-grid relative border-b border-[var(--md-sys-color-outline-variant)]/60">
        <div className="pointer-events-none absolute -left-24 top-16 h-72 w-72 rounded-full bg-[var(--md-sys-color-primary-container)]/60 blur-3xl" />
        <div className="pointer-events-none absolute -right-28 bottom-0 h-80 w-80 rounded-full bg-[var(--md-sys-color-tertiary-container)]/45 blur-3xl" />

        <div className="container relative mx-auto grid min-h-[calc(100svh-4rem)] max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1.08fr_0.92fr] lg:px-8 lg:py-24">
          <div className="max-w-3xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-lowest)]/85 px-4 py-2 text-sm font-semibold text-[var(--md-sys-color-on-surface-variant)] shadow-sm backdrop-blur">
              <Sparkles className="h-4 w-4 text-[var(--md-sys-color-primary)]" />
              {t("eyebrow")}
            </div>

            <h1 className="max-w-3xl text-balance text-5xl font-bold leading-[1.04] tracking-[-0.045em] text-[var(--md-sys-color-on-surface)] sm:text-6xl lg:text-7xl">
              {t("titlePrefix")}
              <span className="text-gradient">{t("titleHighlight")}</span>
            </h1>

            <p className="mt-7 max-w-2xl text-lg leading-8 text-[var(--md-sys-color-on-surface-variant)] sm:text-xl">
              {t("description")}
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="btn-gradient h-14 px-7 text-base font-semibold shadow-lg">
                <Link href="/tools">
                  {t("exploreTools")}
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-14 border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-lowest)]/70 px-7 text-base font-semibold backdrop-blur hover:bg-[var(--md-sys-color-surface-container-low)]"
              >
                <Link href="/canvas">
                  <Workflow className="h-5 w-5" />
                  {t("openCanvas")}
                </Link>
              </Button>
            </div>

            <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-sm text-[var(--md-sys-color-on-surface-variant)]">
              <span className="inline-flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[var(--md-sys-color-primary)]" />
                {t("localFirst")}
              </span>
              <span className="inline-flex items-center gap-2">
                <Zap className="h-4 w-4 text-[var(--md-sys-color-primary)]" />
                {t("readyToUse")}
              </span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-xl lg:mx-0 lg:justify-self-end">
            <div className="absolute -inset-5 -rotate-2 rounded-[2.5rem] bg-[var(--md-sys-color-primary-container)]/55" />
            <div className="relative overflow-hidden rounded-[2rem] border border-[var(--md-sys-color-outline-variant)]/80 bg-[var(--md-sys-color-surface-container-lowest)]/90 p-4 shadow-[0_24px_70px_rgba(33,65,35,0.16)] backdrop-blur-xl sm:p-6">
              <div className="flex items-center justify-between gap-4 border-b border-[var(--md-sys-color-outline-variant)]/70 pb-4">
                <div>
                  <p className="text-sm font-bold text-[var(--md-sys-color-on-surface)]">{t("previewTitle")}</p>
                  <p className="mt-1 text-xs text-[var(--md-sys-color-on-surface-variant)]">{t("previewSubtitle")}</p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--md-sys-color-secondary-container)] px-3 py-1.5 text-xs font-bold text-[var(--md-sys-color-on-secondary-container)]">
                  <span className="h-2 w-2 rounded-full bg-[var(--md-sys-color-primary)]" />
                  {t("available")}
                </span>
              </div>

              <div className="mt-4 flex items-center gap-3 rounded-2xl bg-[var(--md-sys-color-surface-container)] px-4 py-3 text-[var(--md-sys-color-on-surface-variant)]">
                <Search className="h-5 w-5" />
                <span className="text-sm">{t("searchExample")}</span>
                <kbd className="ml-auto hidden rounded-lg border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-lowest)] px-2 py-1 text-[11px] font-semibold sm:inline">⌘ K</kbd>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                {featuredTools.slice(0, 3).map((tool, index) => {
                  const Icon = tool.icon
                  return (
                    <div
                      key={tool.id}
                      className={`rounded-2xl border border-[var(--md-sys-color-outline-variant)]/70 bg-[var(--md-sys-color-surface-container-low)] p-4 ${index === 0 ? "col-span-2" : ""}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tool.accent}`}>
                          <Icon className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-[var(--md-sys-color-on-surface)]">
                            {toolsT(`${tool.translationKey}.name`)}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-[var(--md-sys-color-on-surface-variant)]">
                            {t(tool.descriptionKey)}
                          </p>
                        </div>
                        {index === 0 && (
                          <span className="ml-auto flex h-7 w-7 items-center justify-center rounded-full bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)]">
                            <Check className="h-4 w-4" />
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="mt-4 rounded-2xl bg-[var(--md-sys-color-inverse-surface)] p-4 text-[var(--md-sys-color-inverse-on-surface)]">
                <div className="flex items-center gap-3 text-xs font-semibold sm:text-sm">
                  <span className="rounded-lg bg-white/10 px-2.5 py-1.5">Text</span>
                  <ArrowRight className="h-4 w-4 opacity-60" />
                  <span className="rounded-lg bg-white/10 px-2.5 py-1.5">SHA-256</span>
                  <ArrowRight className="h-4 w-4 opacity-60" />
                  <span className="truncate text-[var(--md-sys-color-inverse-primary)]">2cf24dba…</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-[var(--md-sys-color-primary)]">
              {t("featuredEyebrow")}
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-[var(--md-sys-color-on-surface)] sm:text-4xl">
              {t("featuredTitle")}
            </h2>
            <p className="mt-3 max-w-2xl text-[var(--md-sys-color-on-surface-variant)]">
              {t("featuredDescription")}
            </p>
          </div>
          <Link
            href="/tools"
            className="inline-flex min-h-12 items-center gap-2 self-start rounded-full px-1 text-sm font-bold text-[var(--md-sys-color-primary)] transition-colors hover:text-[var(--md-sys-color-tertiary)] sm:self-auto"
          >
            {t("browseAll")}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {featuredTools.map((tool) => {
            const Icon = tool.icon
            return (
              <Link
                key={tool.id}
                href={`/tools?tool=${tool.id}`}
                className="group rounded-[1.75rem] border border-[var(--md-sys-color-outline-variant)]/75 bg-[var(--md-sys-color-surface-container-lowest)] p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-[var(--md-sys-color-primary)]/40 hover:shadow-xl"
              >
                <span className={`flex h-12 w-12 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-105 ${tool.accent}`}>
                  <Icon className="h-6 w-6" />
                </span>
                <h3 className="mt-6 font-bold text-[var(--md-sys-color-on-surface)]">
                  {toolsT(`${tool.translationKey}.name`)}
                </h3>
                <p className="mt-2 text-sm leading-6 text-[var(--md-sys-color-on-surface-variant)]">
                  {t(tool.descriptionKey)}
                </p>
                <span className="mt-6 inline-flex items-center gap-1 text-sm font-bold text-[var(--md-sys-color-primary)]">
                  {t("openTool")}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            )
          })}
        </div>
      </section>

      <section className="container mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8 lg:pb-24">
        <div className="relative overflow-hidden rounded-[2rem] bg-[var(--md-sys-color-inverse-surface)] px-6 py-10 text-[var(--md-sys-color-inverse-on-surface)] sm:px-10 lg:flex lg:items-center lg:justify-between lg:px-14 lg:py-12">
          <div className="pointer-events-none absolute -right-16 -top-28 h-64 w-64 rounded-full border-[38px] border-[var(--md-sys-color-inverse-primary)]/15" />
          <div className="relative max-w-2xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-[var(--md-sys-color-inverse-primary)]">
              <Workflow className="h-6 w-6" />
            </div>
            <h2 className="mt-6 text-3xl font-bold tracking-tight">{t("canvasTitle")}</h2>
            <p className="mt-3 leading-7 opacity-75">{t("canvasDescription")}</p>
          </div>
          <Button asChild size="lg" className="relative mt-8 h-14 bg-[var(--md-sys-color-inverse-primary)] px-7 font-bold text-[var(--md-sys-color-on-primary-container)] hover:bg-[var(--md-sys-color-inverse-primary)]/90 lg:mt-0">
            <Link href="/canvas">
              {t("buildWorkflow")}
              <ArrowRight className="h-5 w-5" />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  )
}
