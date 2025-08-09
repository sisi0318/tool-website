"use client"

import { createContext, useContext, useState, useCallback, type ReactNode } from "react"
import { translations } from "@/lib/translations"

// Create a context for translations
interface TranslationsContextType {
  locale: string
  setLocale: (locale: string) => void
  t: (key: string) => string
}

const I18nContext = createContext<TranslationsContextType | undefined>(undefined)

export function I18nProvider({
  children,
  locale = "zh",
}: {
  children: ReactNode
  locale: string
}) {
  const [currentLocale, setCurrentLocale] = useState(locale)

  const t = useCallback(
    (key: string) => {
      const keys = key.split(".")
      let value = translations[currentLocale] || translations["zh"]

      for (const k of keys) {
        if (value && typeof value === "object" && k in value) {
          value = value[k]
        } else {
          return key // If translation not found, return the original key
        }
      }

      return typeof value === "string" ? value : key
    },
    [currentLocale],
  )

  const setLocale = useCallback(
    (newLocale: string) => {
      if (newLocale !== currentLocale && (newLocale === "zh" || newLocale === "en")) {
        setCurrentLocale(newLocale)
        // Save to localStorage for persistence
        if (typeof window !== "undefined") {
          localStorage.setItem("locale", newLocale)
        }
      }
    },
    [currentLocale],
  )

  return <I18nContext.Provider value={{ locale: currentLocale, setLocale, t }}>{children}</I18nContext.Provider>
}

export const useI18n = () => {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider")
  }
  return context
}
