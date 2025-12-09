"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { MoonIcon, SunIcon, HomeIcon, Settings } from "lucide-react"
import { useTheme } from "next-themes"
import { useTranslations } from "@/hooks/use-translations"
import { LanguageSwitcher } from "@/components/language-switcher"
import { cn } from "@/lib/utils"

/**
 * M3 Top App Bar Header Component
 * 
 * Implements Material You 3 Expressive Top App Bar specifications with:
 * - Proper surface color and elevation
 * - Scroll behavior with elevation change and color transition
 * - Animated theme toggle with sun/moon icon transition
 * - Minimum 48dp touch targets for accessibility
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4, 12.1
 */

/**
 * M3 Icon Button Component
 * Provides minimum 48dp touch target with proper M3 styling
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
          // State layers
          "hover:bg-[var(--md-sys-color-on-surface)]/[0.08]",
          "focus-visible:bg-[var(--md-sys-color-on-surface)]/[0.12]",
          "active:bg-[var(--md-sys-color-on-surface)]/[0.12]",
          // Transitions
          "transition-all duration-[var(--md-sys-motion-duration-short2)]",
          "ease-[var(--md-sys-motion-easing-standard)]",
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
 * Animated Theme Toggle Component
 * Provides smooth icon transition between sun and moon states
 */
function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const t = useTranslations("common")
  const [mounted, setMounted] = React.useState(false)

  // Avoid hydration mismatch
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
            "transition-all duration-[var(--md-sys-motion-duration-medium2)]",
            "ease-[var(--md-sys-motion-easing-standard)]",
            theme === "dark"
              ? "rotate-0 scale-100 opacity-100"
              : "rotate-90 scale-0 opacity-0"
          )}
        />
        {/* Moon icon - visible in light mode */}
        <MoonIcon
          className={cn(
            "absolute inset-0 h-6 w-6",
            "transition-all duration-[var(--md-sys-motion-duration-medium2)]",
            "ease-[var(--md-sys-motion-easing-standard)]",
            theme === "dark"
              ? "-rotate-90 scale-0 opacity-0"
              : "rotate-0 scale-100 opacity-100"
          )}
        />
      </span>
    </M3IconButton>
  )
}

/**
 * Custom hook for scroll-based elevation
 * Returns true when page is scrolled past threshold
 */
function useScrollElevation(threshold: number = 10) {
  const [isScrolled, setIsScrolled] = React.useState(false)

  React.useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > threshold)
    }

    // Check initial scroll position
    handleScroll()

    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [threshold])

  return isScrolled
}

/**
 * M3 Top App Bar Header
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
        // Surface color with tonal elevation
        "bg-[var(--md-sys-color-surface)]",
        // Border
        "border-b border-[var(--md-sys-color-outline-variant)]",
        // Transitions for scroll behavior
        "transition-all duration-[var(--md-sys-motion-duration-medium2)]",
        "ease-[var(--md-sys-motion-easing-standard)]",
        // Elevated state on scroll
        isScrolled && [
          "bg-[var(--md-sys-color-surface-container)]",
          "shadow-md",
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
            "flex items-center gap-3",
            // Touch target
            "min-h-[48px] py-2",
            // Hover state
            "rounded-[var(--md-sys-shape-corner-medium)]",
            "hover:bg-[var(--md-sys-color-on-surface)]/[0.08]",
            "transition-colors duration-[var(--md-sys-motion-duration-short2)]",
            "ease-[var(--md-sys-motion-easing-standard)]",
            "px-2 -ml-2"
          )}
        >
          {/* Logo icon container */}
          <div
            className={cn(
              "w-10 h-10 flex items-center justify-center",
              "bg-[var(--md-sys-color-primary)]",
              "rounded-[var(--md-sys-shape-corner-medium)]",
              "transition-transform duration-[var(--md-sys-motion-duration-medium2)]",
              "ease-[var(--md-sys-motion-easing-emphasized)]",
              "group-hover:scale-105"
            )}
          >
            <Settings className="h-5 w-5 text-[var(--md-sys-color-on-primary)]" />
          </div>
          {/* Brand name - M3 Title Large */}
          <span
            className={cn(
              "font-medium text-lg",
              "text-[var(--md-sys-color-on-surface)]",
              "hidden sm:inline"
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
 * Navigation Link Component
 * M3 styled navigation item with proper touch targets
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
        "inline-flex items-center justify-center",
        "min-h-[48px] px-4",
        "rounded-[var(--md-sys-shape-corner-full)]",
        // Typography - M3 Label Large
        "text-sm font-medium",
        // Colors based on active state
        active
          ? [
              "bg-[var(--md-sys-color-secondary-container)]",
              "text-[var(--md-sys-color-on-secondary-container)]",
            ]
          : [
              "text-[var(--md-sys-color-on-surface-variant)]",
              "hover:bg-[var(--md-sys-color-on-surface)]/[0.08]",
            ],
        // Transitions
        "transition-all duration-[var(--md-sys-motion-duration-short2)]",
        "ease-[var(--md-sys-motion-easing-standard)]",
        // Focus ring
        "focus-visible:outline-none focus-visible:ring-2",
        "focus-visible:ring-[var(--md-sys-color-primary)]",
        "focus-visible:ring-offset-2"
      )}
    >
      {children}
    </Link>
  )
}
