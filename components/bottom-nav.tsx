"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Workflow, Wrench } from "lucide-react"

import { useTranslations } from "@/hooks/use-translations"
import { cn } from "@/lib/utils"

export function BottomNav() {
  const pathname = usePathname()
  const t = useTranslations("common")

  if (pathname.startsWith("/canvas")) {
    return null
  }

  const navItems = [
    {
      label: t("home"),
      icon: Home,
      href: "/",
      isActive: pathname === "/",
    },
    {
      label: t("tools"),
      icon: Wrench,
      href: "/tools",
      isActive: pathname.startsWith("/tools"),
    },
    {
      label: t("canvas"),
      icon: Workflow,
      href: "/canvas",
      isActive: pathname.startsWith("/canvas"),
    },
  ]

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden">
      <nav
        aria-label={t("siteName")}
        className="mx-auto flex h-[4.75rem] w-full max-w-md items-center justify-around rounded-[1.75rem] border border-[var(--md-sys-color-outline-variant)]/70 bg-[var(--md-sys-color-surface-container)]/95 px-2 shadow-[0_12px_40px_rgba(22,45,24,0.18)] backdrop-blur-xl"
      >
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={item.isActive ? "page" : undefined}
              className="group flex min-h-14 min-w-[4.5rem] flex-col items-center justify-center gap-1 rounded-2xl px-2"
            >
              <span
                className={cn(
                  "flex h-8 w-14 items-center justify-center rounded-full transition-all duration-300 ease-md-expressive",
                  item.isActive
                    ? "bg-[var(--md-sys-color-secondary-container)] text-[var(--md-sys-color-on-secondary-container)]"
                    : "text-[var(--md-sys-color-on-surface-variant)] group-hover:bg-[var(--md-sys-color-surface-container-high)] group-hover:text-[var(--md-sys-color-on-surface)]",
                )}
              >
                <Icon className={cn("h-5 w-5 transition-transform", item.isActive && "scale-105")} />
              </span>
              <span
                className={cn(
                  "text-[11px] font-semibold tracking-wide",
                  item.isActive
                    ? "text-[var(--md-sys-color-on-surface)]"
                    : "text-[var(--md-sys-color-on-surface-variant)]",
                )}
              >
                {item.label}
              </span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
