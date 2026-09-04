import { zh } from "./zh"

/**
 * 文案入口。
 *
 * 中文是站点主语言、服务端也按它渲染，所以静态引入；英文只在用户真正切换时
 * 动态加载 —— 此前两种语言合在一个 280KB 的文件里进根布局共享 chunk，
 * 每个访客都要下载自己用不到的那半。
 */

export type Locale = "zh" | "en"

export type Dictionary = typeof zh

export const LOCALES: readonly Locale[] = ["zh", "en"]

export const DEFAULT_LOCALE: Locale = "zh"

export { zh }

/** 已加载的语言包。中文始终就位，英文加载一次后复用。 */
const loaded = new Map<Locale, Dictionary>([["zh", zh]])

export function getLoadedDictionary(locale: Locale): Dictionary | undefined {
  return loaded.get(locale)
}

export async function loadDictionary(locale: Locale): Promise<Dictionary> {
  const cached = loaded.get(locale)
  if (cached) return cached

  const dictionary = (await import("./en")).en as unknown as Dictionary
  loaded.set(locale, dictionary)
  return dictionary
}

/** 按 "a.b.c" 取值；取不到时返回键本身，便于在界面上看出缺哪条 */
export function resolveTranslation(dictionary: Dictionary, key: string): string {
  let value: unknown = dictionary

  for (const segment of key.split(".")) {
    if (value && typeof value === "object" && segment in value) {
      value = (value as Record<string, unknown>)[segment]
    } else {
      return key
    }
  }

  return typeof value === "string" ? value : key
}
