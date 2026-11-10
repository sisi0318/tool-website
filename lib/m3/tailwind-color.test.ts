import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative, sep } from "node:path"
import defaultTheme from "tailwindcss/defaultTheme"
import { describe, expect, it } from "vitest"

import tailwindConfig from "../../tailwind.config"
import { resolveTokenColor, tokenColor } from "./tailwind-color"

describe("tokenColor", () => {
  it("answers with the bare variable when the class has no opacity modifier", () => {
    expect(resolveTokenColor("primary")).toBe("var(--md-sys-color-primary)")
    // bg-md-primary：Tailwind 传进来的是它自己的透明度变量
    expect(resolveTokenColor("primary", "var(--tw-bg-opacity, 1)")).toBe("var(--md-sys-color-primary)")
    expect(resolveTokenColor("on-surface", "var(--tw-text-opacity, 1)")).toBe("var(--md-sys-color-on-surface)")
  })

  it("mixes the token with transparent for a modifier", () => {
    // bg-md-primary/90
    expect(resolveTokenColor("primary", "0.9")).toBe("color-mix(in srgb, var(--md-sys-color-primary) 90%, transparent)")
    // hover:bg-md-on-surface/[0.08]
    expect(resolveTokenColor("on-surface", "0.08")).toBe("color-mix(in srgb, var(--md-sys-color-on-surface) 8%, transparent)")
    expect(resolveTokenColor("scrim", "0.325")).toBe("color-mix(in srgb, var(--md-sys-color-scrim) 32.5%, transparent)")
    // 渐变的透明端点：from-md-primary 会要一个透明度为 0 的同色
    expect(resolveTokenColor("primary", "0")).toBe("color-mix(in srgb, var(--md-sys-color-primary) 0%, transparent)")
  })

  it("passes an opacity it cannot read as a number through calc()", () => {
    expect(resolveTokenColor("primary", "var(--fade)")).toBe(
      "color-mix(in srgb, var(--md-sys-color-primary) calc(var(--fade) * 100%), transparent)",
    )
  })

  it("hands Tailwind a function, called with or without an opacity", () => {
    const color = tokenColor("error") as unknown as (options?: { opacityValue?: string }) => string
    expect(typeof color).toBe("function")
    expect(color()).toBe("var(--md-sys-color-error)")
    expect(color({})).toBe("var(--md-sys-color-error)")
    expect(color({ opacityValue: "0.4" })).toBe("color-mix(in srgb, var(--md-sys-color-error) 40%, transparent)")
  })
})

/** app、components、hooks、lib 下的非测试源码 */
function sourceFiles(): { file: string; lines: string[] }[] {
  const files: { file: string; lines: string[] }[] = []
  const walk = (directory: string) => {
    for (const name of readdirSync(directory)) {
      const full = join(directory, name)
      if (statSync(full).isDirectory()) {
        if (name !== "node_modules" && name !== ".next") walk(full)
        continue
      }
      if (!/\.tsx?$/.test(name) || /\.test\.tsx?$/.test(name)) continue
      // 这个文件的注释里写着反例
      if (full === join(process.cwd(), "lib", "m3", "tailwind-color.ts")) continue
      files.push({
        file: relative(process.cwd(), full).split(sep).join("/"),
        lines: readFileSync(full, "utf8").split(/\r?\n/),
      })
    }
  }
  ;["app", "components", "hooks", "lib"].forEach((root) => walk(join(process.cwd(), root)))
  return files
}

/**
 * 这两种写法 Tailwind 都不报错，只是一条规则也不生成：2026-11 发现时全站有 210 处，
 * 包括四个对话框的遮罩、顶栏的底色和所有按钮的悬停态。
 */
describe("opacity modifiers on M3 colours", () => {
  const declared = new Set(
    [...readFileSync(join(process.cwd(), "tailwind.config.ts"), "utf8").matchAll(/"md-([a-z-]+)": tokenColor\("([a-z-]+)"\)/g)].map(
      ([, key, name]) => {
        expect(key, "主题里的名字要和令牌同名").toBe(name)
        return name
      },
    ),
  )

  it("finds the tokens declared in tailwind.config.ts", () => {
    expect(declared.size).toBeGreaterThan(30)
    expect(declared.has("primary") && declared.has("on-surface") && declared.has("scrim")).toBe(true)
  })

  it("are never put on an arbitrary var(), which compiles to nothing", () => {
    const found: string[] = []
    for (const { file, lines } of sourceFiles()) {
      lines.forEach((line, index) => {
        for (const match of line.matchAll(/[a-z-]+-\[var\(--[a-z0-9-]+\)\]\/(?:\[[0-9.]+\]|[0-9]+)/g)) {
          found.push(`${file}:${index + 1} ${match[0]}`)
        }
      })
    }
    expect(found, "写成主题里的令牌：bg-md-primary/90，而不是 bg-[var(--md-sys-color-primary)]/90").toEqual([])
  })

  it("only go on tokens the theme declares through tokenColor()", () => {
    const found: string[] = []
    for (const { file, lines } of sourceFiles()) {
      lines.forEach((line, index) => {
        for (const match of line.matchAll(/[a-z]+-md-([a-z-]+)\/(?:\[[0-9.]+\]|[0-9]+)/g)) {
          if (!declared.has(match[1])) found.push(`${file}:${index + 1} ${match[0]}`)
        }
      })
    }
    // md-hover、md-pressed 这类写死了透明度的别名不在其列：给它们再加透明度同样不生成规则
    expect(found, "这些颜色加不了透明度").toEqual([])
  })

  it("use a step of the opacity scale, or an arbitrary value in brackets", () => {
    // 刻度只有 5 的倍数（外加主题里补的 38）。写成 /98、/92 同样不生成规则：顶栏滚动后的底色就是这么没的
    const scale = new Set([...Object.keys(defaultTheme.opacity ?? {}), ...Object.keys(tailwindConfig.theme.extend.opacity)])
    expect(scale.has("95") && scale.has("38")).toBe(true)

    const found: string[] = []
    for (const { file, lines } of sourceFiles()) {
      lines.forEach((line, index) => {
        for (const match of line.matchAll(/[a-z]+-md-[a-z-]+\/([0-9]+)(?![0-9\]])/g)) {
          if (!scale.has(match[1])) found.push(`${file}:${index + 1} ${match[0]}`)
        }
      })
    }
    expect(found, "不在刻度上的透明度写成方括号：bg-md-surface/[0.98]").toEqual([])
  })
})
