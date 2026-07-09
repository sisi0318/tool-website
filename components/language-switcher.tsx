"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Globe, Check } from "lucide-react"
import { useI18n } from "@/components/i18n-provider"

const languages = [
  { code: "zh", name: "中文", shortName: "中" },
  { code: "en", name: "English", shortName: "EN" },
]

export function LanguageSwitcher() {
  const [open, setOpen] = useState(false)
  const { locale, setLocale } = useI18n()

  const switchLanguage = (newLocale: string) => {
    setLocale(newLocale)
    setOpen(false)
  }

  const currentLanguage = languages.find(lang => lang.code === locale)

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-11 min-w-11 rounded-full border-0 bg-transparent px-3 hover:bg-[var(--md-sys-color-on-surface)]/[0.08]"
          aria-label={locale === "zh" ? "切换语言" : "Switch language"}
        >
          <Globe className="h-4 w-4" />
          <span className="hidden text-xs font-semibold sm:inline">{currentLanguage?.shortName}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {languages.map((language) => (
          <DropdownMenuItem 
            key={language.code}
            onClick={() => switchLanguage(language.code)}
            className="flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <span>{language.name}</span>
            </div>
            {locale === language.code && (
              <Check className="h-4 w-4 text-blue-600" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
