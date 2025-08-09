"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { MoonIcon, SunIcon, HomeIcon, Settings } from "lucide-react"
import { useTheme } from "next-themes"
import { useTranslations } from "@/hooks/use-translations"
import { LanguageSwitcher } from "@/components/language-switcher"

export default function Header() {
  const { theme, setTheme } = useTheme()
  const pathname = usePathname()
  const t = useTranslations("common")

  return (
    <header className="sticky top-0 z-50 glass-effect border-b border-gray-200/20 dark:border-gray-700/20">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
          <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
            <Settings className="h-5 w-5 text-white" />
          </div>
          <span className="font-bold text-xl text-gradient">
            {t("siteName")}
          </span>
        </Link>

        <nav className="hidden md:flex items-center space-x-6">
          <Link 
            href="/" 
            className={`text-sm font-medium transition-colors hover:text-blue-600 ${
              pathname === "/" ? "text-blue-600" : "text-gray-600 dark:text-gray-300"
            }`}
          >
            {t("home")}
          </Link>
          <Link 
            href="/tools" 
            className={`text-sm font-medium transition-colors hover:text-blue-600 ${
              pathname.startsWith("/tools") ? "text-blue-600" : "text-gray-600 dark:text-gray-300"
            }`}
          >
            {t("tools")}
          </Link>
        </nav>

        <div className="flex items-center space-x-2">
          <Link href="/" className="md:hidden">
            <Button variant="ghost" size="sm" className="button-modern">
              <HomeIcon className="h-4 w-4" />
              <span className="sr-only">{t("home")}</span>
            </Button>
          </Link>

          <LanguageSwitcher />

          <Button 
            variant="ghost" 
            size="sm" 
            className="button-modern" 
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            <SunIcon className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <MoonIcon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">{t("toggleTheme")}</span>
          </Button>
        </div>
      </div>
    </header>
  )
}
