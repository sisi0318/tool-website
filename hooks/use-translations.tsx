"use client"

import { useI18n } from "@/components/i18n-provider"

export function useTranslations(namespace: string) {
  const { t } = useI18n()

  return (key: string) => {
    return t(`${namespace}.${key}`)
  }
}
