"use client"

import { useCallback } from "react"
import { useI18n } from "@/components/i18n-provider"

export function useTranslations(namespace: string) {
  const { t } = useI18n()

  return useCallback((key: string) => t(`${namespace}.${key}`), [namespace, t])
}
