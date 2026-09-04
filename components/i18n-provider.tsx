"use client"

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react"

import { readLocalStorage, writeLocalStorage } from "@/lib/safe-storage"
import {
  DEFAULT_LOCALE,
  getLoadedDictionary,
  loadDictionary,
  resolveTranslation,
  zh,
  type Dictionary,
  type Locale,
} from "@/lib/translations"

interface TranslationsContextType {
  locale: Locale
  setLocale: (locale: string) => void
  t: (key: string) => string
}

const I18nContext = createContext<TranslationsContextType>({
  locale: DEFAULT_LOCALE,
  setLocale: () => undefined,
  t: (key) => resolveTranslation(zh, key),
})

function isLocale(value: string | null): value is Locale {
  return value === "zh" || value === "en"
}

export function I18nProvider({
  children,
  locale = DEFAULT_LOCALE,
}: {
  children: ReactNode
  locale: string
}) {
  const [currentLocale, setCurrentLocale] = useState<Locale>(isLocale(locale) ? locale : DEFAULT_LOCALE)
  // 中文随首屏就位；英文动态加载，未就绪前先用中文渲染，避免整页空白
  const [dictionary, setDictionary] = useState<Dictionary>(zh)

  useEffect(() => {
    const saved = readLocalStorage("locale")
    if (isLocale(saved)) setCurrentLocale(saved)
  }, [])

  useEffect(() => {
    document.documentElement.lang = currentLocale === "zh" ? "zh-CN" : "en"
  }, [currentLocale])

  useEffect(() => {
    const cached = getLoadedDictionary(currentLocale)
    if (cached) {
      setDictionary(cached)
      return
    }

    let active = true
    void loadDictionary(currentLocale).then((next) => {
      if (active) setDictionary(next)
    })
    return () => {
      active = false
    }
  }, [currentLocale])

  const t = useCallback((key: string) => resolveTranslation(dictionary, key), [dictionary])

  const setLocale = useCallback(
    (next: string) => {
      if (!isLocale(next) || next === currentLocale) return
      setCurrentLocale(next)
      writeLocalStorage("locale", next)
    },
    [currentLocale],
  )

  return (
    <I18nContext.Provider value={{ locale: currentLocale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export const useI18n = () => useContext(I18nContext)
