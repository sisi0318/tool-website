"use client"

import { useCallback } from "react"
import { useI18n } from "@/components/i18n-provider"
import { registerZhNamespace } from "@/lib/translations"

/**
 * 取一个命名空间下的文案。公共命名空间（common、tools 等）随首屏就位；
 * 页面自己的命名空间把 zh-namespaces/ 下的中文文案作为第二个参数传进来，
 * 用到时登记（服务端渲染同样经过这里），这样它只随用到它的页面加载。
 */
export function useTranslations(namespace: string, zhStrings?: Record<string, unknown>) {
  const { t } = useI18n()
  if (zhStrings) registerZhNamespace(namespace, zhStrings)

  return useCallback((key: string) => t(`${namespace}.${key}`), [namespace, t])
}
