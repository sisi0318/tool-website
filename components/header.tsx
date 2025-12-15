"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { MoonIcon, SunIcon, HomeIcon, Wrench } from "lucide-react"
import { useTheme } from "next-themes"
import { useTranslations } from "@/hooks/use-translations"
import { LanguageSwitcher } from "@/components/language-switcher"
import { cn } from "@/lib/utils"

/**
 * M3 EXPRESSIVE Top App Bar Header Component
 * 
 * Implements Material You 3 Expressive Top App Bar specifications with:
 * - More vibrant surface colors with gradient effects
 * - Enhanced scroll behavior with smooth color transitions
 * - Animated theme toggle with playful icon transition
 * - Expressive hover states and micro-interactions
 * - Minimum 48dp touch targets for accessibility
 */

/**
 * M3 Expressive Icon Button Component
 * Provides minimum 48dp touch target with expressive M3 styling
 */
interface M3IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode
  "aria-label": string
}

const M3IconButton = React.forwardRef<HTMLButtonElement, M3IconButtonProps>(
  ({ children, className, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          // Base styles with 48dp minimum touch target
          "relative inline-flex items-center justify-center",
          "min-w-[48px] min-h-[48px] w-12 h-12",
          "rounded-[var(--md-sys-shape-corner-full)]",
          // Colors
          "text-[var(--md-sys-color-on-surface-variant)]",
          "bg-transparent",
          // State layers with expressive transitions
          "hover:bg-[var(--md-sys-color-on-surface)]/[0.08]",
          "focus-visible:bg-[var(--md-sys-color-on-surface)]/[0.12]",
          "active:bg-[var(--md-sys-color-on-surface)]/[0.16]",
          "active:scale-95",
          // Expressive transitions
          "transition-all duration-[var(--md-sys-motion-duration-short4)]",
          "ease-[var(--md-sys-motion-easing-expressive)]",
          // Focus ring
          "focus-visible:outline-none focus-visible:ring-2",
          "focus-visible:ring-[var(--md-sys-color-primary)]",
          "focus-visible:ring-offset-2",
          // Disabled state
          "disabled:opacity-38 disabled:pointer-events-none",
          className
        )}
        {...props}
      >
        {children}
      </button>
    )
  }
)
M3IconButton.displayName = "M3IconButton"

/**
 * Animated Theme Toggle Component with Expressive Transitions
 * Provides smooth icon transition between sun and moon states
 */
function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const t = useTranslations("common")
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark")
  }

  if (!mounted) {
    return (
      <M3IconButton aria-label={t("toggleTheme")} disabled>
        <span className="w-6 h-6" />
      </M3IconButton>
    )
  }

  return (
    <M3IconButton
      onClick={toggleTheme}
      aria-label={t("toggleTheme")}
      data-testid="theme-toggle"
    >
      <span className="relative w-6 h-6">
        {/* Sun icon - visible in dark mode */}
        <SunIcon
          className={cn(
            "absolute inset-0 h-6 w-6",
            "transition-all duration-[var(--md-sys-motion-duration-medium3)]",
            "ease-[var(--md-sys-motion-easing-expressive)]",
            theme === "dark"
              ? "rotate-0 scale-100 opacity-100"
              : "rotate-180 scale-0 opacity-0"
          )}
        />
        {/* Moon icon - visible in light mode */}
        <MoonIcon
          className={cn(
            "absolute inset-0 h-6 w-6",
            "transition-all duration-[var(--md-sys-motion-duration-medium3)]",
            "ease-[var(--md-sys-motion-easing-expressive)]",
            theme === "dark"
              ? "-rotate-180 scale-0 opacity-0"
              : "rotate-0 scale-100 opacity-100"
          )}
        />
      </span>
    </M3IconButton>
  )
}

/**
 * Custom hook for scroll-based elevation with smooth transitions
 */
function useScrollElevation(threshold: number = 10) {
  const [isScrolled, setIsScrolled] = React.useState(false)

  React.useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > threshold)
    }

    handleScroll()

    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [threshold])

  return isScrolled
}

/**
 * M3 Expressive Top App Bar Header
 */
export default function Header() {
  const pathname = usePathname()
  const t = useTranslations("common")
  const isScrolled = useScrollElevation()

  return (
    <header
      className={cn(
        // Base styles - M3 Top App Bar
        "sticky top-0 z-50",
        "w-full",
        // Height: 64dp standard for Top App Bar
        "h-16",
        // Surface color with gradient effect
        "bg-[var(--md-sys-color-surface)]/95",
        "backdrop-blur-md",
        // Border
        "border-b border-[var(--md-sys-color-outline-variant)]/50",
        // Expressive transitions for scroll behavior
        "transition-all duration-[var(--md-sys-motion-duration-medium3)]",
        "ease-[var(--md-sys-motion-easing-expressive)]",
        // Elevated state on scroll
        isScrolled && [
          "bg-[var(--md-sys-color-surface-container)]/98",
          "backdrop-blur-xl",
          "shadow-lg shadow-[var(--md-sys-color-shadow)]/10",
          "border-[var(--md-sys-color-outline-variant)]/30",
        ]
      )}
      data-testid="m3-header"
      data-scrolled={isScrolled}
    >
      <div className="container mx-auto px-4 h-full flex items-center justify-between">
        {/* Leading: Logo and brand */}
        <Link
          href="/"
          className={cn(
            "flex items-center gap-3 group",
            // Touch target
            "min-h-[48px] py-2",
            // Hover state with expressive transition
            "rounded-[var(--md-sys-shape-corner-large)]",
            "hover:bg-[var(--md-sys-color-on-surface)]/[0.06]",
            "transition-all duration-[var(--md-sys-motion-duration-short4)]",
            "ease-[var(--md-sys-motion-easing-expressive)]",
            "px-3 -ml-3"
          )}
        >
          {/* Logo icon container with gradient */}
          <div
            className={cn(
              "w-10 h-10 flex items-center justify-center",
              "bg-gradient-to-br from-[var(--md-sys-color-primary)] to-[var(--md-sys-color-tertiary)]",
              "rounded-[var(--md-sys-shape-corner-medium)]",
              "transition-all duration-[var(--md-sys-motion-duration-medium2)]",
              "ease-[var(--md-sys-motion-easing-expressive)]",
              "group-hover:scale-110 group-hover:rotate-3",
              "shadow-md group-hover:shadow-lg"
            )}
          >
            <Wrench className="h-5 w-5 text-white" />
          </div>
          {/* Brand name - M3 Title Large */}
          <span
            className={cn(
              "hidden sm:inline font-semibold text-lg",
              "text-[var(--md-sys-color-on-surface)]",
              "group-hover:text-gradient",
              "transition-colors duration-[var(--md-sys-motion-duration-short4)]"
            )}
          >
            {t("siteName")}
          </span>
        </Link>

        {/* Center: Navigation links (desktop only) */}
        <nav className="hidden md:flex items-center gap-1">
          <NavLink href="/" active={pathname === "/"}>
            {t("home")}
          </NavLink>
          <NavLink href="/tools" active={pathname.startsWith("/tools")}>
            {t("tools")}
          </NavLink>
        </nav>

        {/* Trailing: Actions */}
        <div className="flex items-center gap-1">
          {/* Home button (mobile only) */}
          <Link href="/" className="md:hidden">
            <M3IconButton aria-label={t("home")}>
              <HomeIcon className="h-6 w-6" />
            </M3IconButton>
          </Link>

          {/* Language switcher */}
          <LanguageSwitcher />

          {/* Theme toggle */}
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}

/**
 * Navigation Link Component with Expressive M3 styling
 */
interface NavLinkProps {
  href: string
  active: boolean
  children: React.ReactNode
}

function NavLink({ href, active, children }: NavLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        // Base styles with 48dp touch target
        "relative inline-flex items-center justify-center",
        "min-h-[48px] px-5",
        "rounded-[var(--md-sys-shape-corner-full)]",
        // Typography - M3 Label Large
        "text-sm font-semibold",
        // Colors based on active state
        active
          ? [
              "bg-[var(--md-sys-color-secondary-container)]",
              "text-[var(--md-sys-color-on-secondary-container)]",
              "shadow-sm",
            ]
          : [
              "text-[var(--md-sys-color-on-surface-variant)]",
              "hover:bg-[var(--md-sys-color-on-surface)]/[0.08]",
              "hover:text-[var(--md-sys-color-on-surface)]",
            ],
        // Expressive transitions
        "transition-all duration-[var(--md-sys-motion-duration-short4)]",
        "ease-[var(--md-sys-motion-easing-expressive)]",
        "hover:scale-105 active:scale-95",
        // Focus ring
        "focus-visible:outline-none focus-visible:ring-2",
        "focus-visible:ring-[var(--md-sys-color-primary)]",
        "focus-visible:ring-offset-2"
      )}
    >
      {children}
      {/* Active indicator */}
      {active && (
        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-1 bg-[var(--md-sys-color-secondary)] rounded-full" />
      )}
    </Link>
  )
}
