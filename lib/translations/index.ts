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

/**
 * 各页面自己的中文文案（zh-namespaces/ 下）。随页面模块加载，经 useTranslations 的第二个参数登记；
 * 以前全部中文都在 zh.ts 里，随根布局进了每个页面的首屏。
 */
const zhNamespaces: Record<string, unknown> = {}

export function registerZhNamespace(namespace: string, strings: Record<string, unknown>): void {
  if (!(namespace in zhNamespaces)) zhNamespaces[namespace] = strings
}

/** 按 "a.b.c" 取值；取不到时返回键本身，便于在界面上看出缺哪条 */
export function resolveTranslation(dictionary: Dictionary, key: string): string {
  const segments = key.split(".")
  // 中文的公共部分里没有这个命名空间，就到各页面登记的文案里找
  let value: unknown = dictionary === zh && !(segments[0] in zh) ? zhNamespaces : dictionary

  for (const segment of segments) {
    if (value && typeof value === "object" && segment in value) {
      value = (value as Record<string, unknown>)[segment]
    } else {
      return key
    }
  }

  return typeof value === "string" ? value : key
}
