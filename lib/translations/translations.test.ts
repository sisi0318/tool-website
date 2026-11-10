import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative, sep } from "node:path"
import { beforeAll, describe, expect, it } from "vitest"

import { en } from "./en"
import { zh } from "./zh"
import { DEFAULT_LOCALE, getLoadedDictionary, loadDictionary, registerZhNamespace, resolveTranslation } from "./index"

/** zh-namespaces/ 下各页面的中文文案，按文件名对应命名空间 */
const NAMESPACE_DIR = join(process.cwd(), "lib/translations/zh-namespaces")
let zhNamespaceModules: Record<string, Record<string, unknown>> = {}
let zhNamespaces: Record<string, unknown> = {}
/** 公共部分加上各页面的部分，才是完整的中文文案 */
let zhFull: Record<string, unknown> = {}

beforeAll(async () => {
  zhNamespaceModules = Object.fromEntries(
    await Promise.all(readdirSync(NAMESPACE_DIR).filter((file) => file.endsWith(".ts")).map(async (file) => {
      const name = file.slice(0, -3)
      return [name, await import(`./zh-namespaces/${name}.ts`) as Record<string, unknown>] as const
    })),
  )
  zhNamespaces = Object.fromEntries(Object.entries(zhNamespaceModules).map(([name, module]) => [name, Object.values(module)[0]]))
  zhFull = { ...zh, ...zhNamespaces }
})

const exportName = (namespace: string) => `zh${namespace[0].toUpperCase()}${namespace.slice(1)}`

/** 把嵌套字典摊平成 "a.b.c" 键集合 */
function flatten(value: unknown, prefix = ""): string[] {
  if (value === null || typeof value !== "object") return [prefix]
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    flatten(child, prefix ? `${prefix}.${key}` : key),
  )
}

/** app、components、hooks、lib 下的非测试源码；lib/translations 里只有文案本身（注释里写着调用示例），不是调用处 */
function sourceFiles(): { full: string; source: string }[] {
  const files: { full: string; source: string }[] = []
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name)
      if (statSync(full).isDirectory()) {
        if (!["node_modules", ".next"].includes(name) && full !== join(process.cwd(), "lib", "translations")) walk(full)
        continue
      }
      if (!/\.tsx?$/.test(name) || /\.test\.tsx?$/.test(name)) continue
      files.push({ full, source: readFileSync(full, "utf8") })
    }
  }
  ;["app", "components", "hooks", "lib"].forEach((root) => walk(join(process.cwd(), root)))
  return files
}

/** 这条路径上是不是一条文案（取到对象不算：那是一组键，不能直接显示） */
function hasString(dictionary: unknown, path: string): boolean {
  let current: unknown = dictionary
  for (const part of path.split(".")) {
    if (current === null || typeof current !== "object" || !(part in current)) return false
    current = (current as Record<string, unknown>)[part]
  }
  return typeof current === "string"
}

describe("中英文案", () => {
  /**
   * 两份文案拆开维护后最容易出现的问题就是漂移 —— 此前就有只存在于英文侧、
   * 无任何调用方的 showAllAlgorithmResults，以及只有中文侧才有的键。
   */
  it("键完全对齐", () => {
    const zhKeys = new Set(flatten(zhFull))
    const enKeys = new Set(flatten(en))

    expect([...zhKeys].filter((key) => !enKeys.has(key)).sort(), "英文缺少这些键").toEqual([])
    expect([...enKeys].filter((key) => !zhKeys.has(key)).sort(), "中文缺少这些键").toEqual([])
  })

  it("没有空文案", () => {
    for (const [locale, dictionary] of [["zh", zhFull as typeof zh], ["en", en]] as const) {
      for (const key of flatten(dictionary)) {
        expect(resolveTranslation(dictionary, key).trim(), `${locale}.${key} 为空`).not.toBe("")
      }
    }
  })

  it("中文随首屏就位，英文按需加载", async () => {
    expect(DEFAULT_LOCALE).toBe("zh")
    expect(getLoadedDictionary("zh")).toBe(zh)

    const loaded = await loadDictionary("en")
    expect(loaded).toBe(en)
    // 加载过一次后进缓存，切回来不再重复请求
    expect(getLoadedDictionary("en")).toBe(en)
  })
})

describe("页面自己的中文文案", () => {
  it("每个文件只导出 zh + 命名空间名，也不和公共部分重名", () => {
    for (const [name, module] of Object.entries(zhNamespaceModules)) {
      expect(Object.keys(module), name).toEqual([exportName(name)])
      expect(name in zh, `${name} 同时在 zh.ts 里`).toBe(false)
    }
  })

  /**
   * 页面的命名空间没随调用处传进来，界面上就会显示成键名。
   * 这里扫一遍源码：没传文案的只能是公共命名空间；传了的必须是对应文件里的那一份。
   */
  it("每个 useTranslations 都拿得到自己的文案", () => {
    const problems: string[] = []
    for (const { full, source } of sourceFiles()) {
      for (const match of source.matchAll(/useTranslations\(\s*"([A-Za-z0-9_]+)"\s*(?:,\s*([A-Za-z0-9_]+)\s*)?\)/g)) {
        const [, namespace, strings] = match
        if (!strings) {
          if (!(namespace in zh)) problems.push(`${full}: useTranslations("${namespace}") 没有传文案`)
          continue
        }
        if (strings !== exportName(namespace) || !(namespace in zhNamespaceModules)) {
          problems.push(`${full}: useTranslations("${namespace}", ${strings}) 对不上`)
        } else if (!source.includes(`import { ${strings} } from "@/lib/translations/zh-namespaces/${namespace}"`)) {
          problems.push(`${full}: 没有从 zh-namespaces/${namespace} 引入 ${strings}`)
        }
      }
    }
    expect(problems).toEqual([])
  })

  /**
   * 命名空间对了，键写错或忘了加，界面上同样显示成键名：JSON 页的工具栏就把
   * “common.paste”“common.loadSample” 原样显示出来上过线，另有三处 aria-label 让读屏念键名。
   * 这里把每个 `const t = useTranslations("ns")` 之后写成字面量的 t("key") 都对一遍。
   * 中英的键已由上面的用例对齐，对着英文那一份查就够了；拼出来的键（t(`errors.${code}`)）查不了，跳过。
   */
  it("调用处写死的键都有文案", () => {
    const problems: string[] = []
    let checked = 0
    for (const { full, source } of sourceFiles()) {
      const translators = new Map<string, Set<string>>()
      for (const match of source.matchAll(/(?:const|let)\s+(\w+)\s*=\s*useTranslations\(\s*"([A-Za-z0-9_]+)"/g)) {
        translators.set(match[1], (translators.get(match[1]) ?? new Set<string>()).add(match[2]))
      }
      if (translators.size === 0) continue
      const lines = source.split(/\r?\n/)
      for (const [name, namespaces] of translators) {
        // 同一个文件里不同组件可能都把翻译函数叫 t，却各用各的命名空间：任何一个取得到就算有
        const call = new RegExp(String.raw`(?<![\w.$])${name}\(\s*["']([\w.]+)["']\s*\)`, "g")
        lines.forEach((line, index) => {
          for (const match of line.matchAll(call)) {
            checked += 1
            if ([...namespaces].some((namespace) => hasString(en, `${namespace}.${match[1]}`))) continue
            const file = relative(process.cwd(), full).split(sep).join("/")
            problems.push(`${file}:${index + 1} ${[...namespaces].join(" | ")}.${match[1]}`)
          }
        })
      }
    }
    expect(problems).toEqual([])
    // 正则万一失效（比如调用写法整体变了），零命中也会“通过”；全站现在有三千多处
    expect(checked).toBeGreaterThan(1000)
  })

  it("登记之后按命名空间取得到", () => {
    expect(resolveTranslation(zh, "regex.title")).toBe("regex.title")
    registerZhNamespace("regex", zhNamespaces.regex as Record<string, unknown>)
    expect(resolveTranslation(zh, "regex.title")).toBe("正则表达式测试工具")
  })
})

describe("resolveTranslation", () => {
  it("按点号路径取值", () => {
    expect(resolveTranslation(zh, "common.siteName")).toBe("工具站")
  })

  it("取不到时返回键本身，便于在界面上看出缺哪条", () => {
    expect(resolveTranslation(zh, "nope.missing")).toBe("nope.missing")
    // 命中的是对象而不是字符串时同样按缺失处理
    expect(resolveTranslation(zh, "common")).toBe("common")
  })
})
