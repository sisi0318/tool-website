"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Wrench, Search, Settings } from "lucide-react"
import { cn } from "@/lib/utils"
import { useTranslations } from "@/hooks/use-translations"

/**
 * M3 Bottom Navigation Bar
 * 
 * Implements Material You 3 Bottom Navigation specifications:
 * - Fixed at bottom
 * - Elevation and colored surface container
 * - 3-5 destinations
 * - Active indicator (pill shape)
 * - Safe area support
 */
export function BottomNav() {
    const pathname = usePathname()
    const t = useTranslations("common")

    // Hide on desktop/tablet - visible only on mobile
    // Also hide if we are in a fullscreen tool mode if desired, but standards suggest keeping nav.

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
        // We can add more items here if needed, e.g. favorites or settings
    ]

    return (
        <div className="md:hidden fixed bottom-1 left-0 right-0 z-50 px-4 pb-4 ptr-safe">
            <nav
                className={cn(
                    "w-full mx-auto max-w-md",
                    "h-20 px-2",
                    "bg-[var(--md-sys-color-surface-container)]",
                    "rounded-[var(--md-sys-shape-corner-extra-large)]",
                    "shadow-lg shadow-[var(--md-sys-color-shadow)]/10",
                    "border border-[var(--md-sys-color-outline-variant)]/50",
                    "flex items-center justify-around",
                    "backdrop-blur-xl bg-opacity-95"
                )}
            >
                {navItems.map((item) => {
                    const Icon = item.icon
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "flex flex-col items-center justify-center gap-1",
                                "px-2 py-1 min-w-[64px]",
                                "group relative"
                            )}
                        >
                            {/* Active Indicator Pill */}
                            <div
                                className={cn(
                                    "absolute top-0 h-8 w-16 rounded-full -z-10",
                                    "transition-all duration-300 ease-[var(--md-sys-motion-easing-expressive)]",
                                    item.isActive
                                        ? "bg-[var(--md-sys-color-secondary-container)] opacity-100 scale-100"
                                        : "bg-transparent opacity-0 scale-50"
                                )}
                            />

                            {/* Icon */}
                            <Icon
                                className={cn(
                                    "w-6 h-6",
                                    "transition-all duration-300",
                                    item.isActive
                                        ? "text-[var(--md-sys-color-on-secondary-container)]"
                                        : "text-[var(--md-sys-color-on-surface-variant)] group-hover:text-[var(--md-sys-color-on-surface)]"
                                )}
                            />

                            {/* Label */}
                            <span
                                className={cn(
                                    "text-xs font-medium tracking-wide",
                                    "transition-all duration-300",
                                    item.isActive
                                        ? "text-[var(--md-sys-color-on-surface)] font-bold"
                                        : "text-[var(--md-sys-color-on-surface-variant)]"
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
