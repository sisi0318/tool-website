"use client"

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react"
import { translations } from "@/lib/translations"
import { readLocalStorage, writeLocalStorage } from "@/lib/safe-storage"

// Create a context for translations
interface TranslationsContextType {
  locale: string
  setLocale: (locale: string) => void
  t: (key: string) => string
}

function resolveTranslation(locale: "zh" | "en", key: string) {
  const keys = key.split(".")
  let value: unknown = translations[locale]

  for (const segment of keys) {
    if (value && typeof value === "object" && segment in value) {
      value = (value as Record<string, unknown>)[segment]
    } else {
      return key
    }
  }

  return typeof value === "string" ? value : key
}

const I18nContext = createContext<TranslationsContextType>({
  locale: "zh",
  setLocale: () => undefined,
  t: (key) => resolveTranslation("zh", key),
})

export function I18nProvider({
  children,
  locale = "zh",
}: {
  children: ReactNode
  locale: string
}) {
  const [currentLocale, setCurrentLocale] = useState<"zh" | "en">(locale === "en" ? "en" : "zh")

  useEffect(() => {
    const savedLocale = readLocalStorage("locale")
    if (savedLocale === "zh" || savedLocale === "en") {
      setCurrentLocale(savedLocale)
    }
  }, [])

  useEffect(() => {
    document.documentElement.lang = currentLocale
  }, [currentLocale])

  const t = useCallback(
    (key: string) => resolveTranslation(currentLocale, key),
    [currentLocale],
  )

  const setLocale = useCallback(
    (newLocale: string) => {
      if (newLocale !== currentLocale && (newLocale === "zh" || newLocale === "en")) {
        setCurrentLocale(newLocale)
        // Save to localStorage for persistence
        writeLocalStorage("locale", newLocale)
      }
    },
    [currentLocale],
  )

  return <I18nContext.Provider value={{ locale: currentLocale, setLocale, t }}>{children}</I18nContext.Provider>
}

export const useI18n = () => {
  return useContext(I18nContext)
}
