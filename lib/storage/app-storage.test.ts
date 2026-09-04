import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { beforeEach, describe, expect, it } from "vitest"

import {
  STORAGE_ENTRIES,
  clearAppStorage,
  formatStorageSize,
  readStorageUsage,
} from "./app-storage"

beforeEach(() => {
  window.localStorage.clear()
})

describe("readStorageUsage", () => {
  it("按分组统计已登记的键", () => {
    window.localStorage.setItem("tool_favorite_ids", '["hash"]')
    window.localStorage.setItem("canvas-state", '{"nodes":[],"edges":[]}')
    window.localStorage.setItem("WORKFLOW_我的流程", '{"nodes":[],"edges":[]}')

    const usage = readStorageUsage()
    const byGroup = Object.fromEntries(usage.map((item) => [item.group, item]))

    expect(byGroup.workspace.keys).toEqual(["tool_favorite_ids"])
    expect(byGroup.canvas.keys.sort()).toEqual(["WORKFLOW_我的流程", "canvas-state"])
    expect(byGroup.canvas.bytes).toBeGreaterThan(0)
    // 画布配置里可能有密钥，这一组要标为敏感
    expect(byGroup.canvas.sensitive).toBe(true)
    expect(byGroup.workspace.sensitive).toBe(false)
  })

  it("不统计本站以外的键", () => {
    window.localStorage.setItem("some-other-app", "x")
    expect(readStorageUsage()).toEqual([])
  })
})

describe("clearAppStorage", () => {
  it("按分组清除，不碰其它分组与同域下的其它数据", () => {
    window.localStorage.setItem("some-other-app", "keep me")
    window.localStorage.setItem("tool_favorite_ids", '["hash"]')
    window.localStorage.setItem("canvas-state", "{}")
    window.localStorage.setItem("WORKFLOW_a", "{}")

    expect(clearAppStorage(["canvas"])).toBe(2)

    expect(window.localStorage.getItem("canvas-state")).toBeNull()
    expect(window.localStorage.getItem("WORKFLOW_a")).toBeNull()
    expect(window.localStorage.getItem("tool_favorite_ids")).toBe('["hash"]')
    expect(window.localStorage.getItem("some-other-app")).toBe("keep me")
  })

  it("不传分组时清除全部已登记的键", () => {
    window.localStorage.setItem("some-other-app", "keep me")
    window.localStorage.setItem("totp_accounts", "[]")
    window.localStorage.setItem("locale", "en")

    expect(clearAppStorage()).toBe(2)
    expect(window.localStorage.getItem("some-other-app")).toBe("keep me")
    expect(readStorageUsage()).toEqual([])
  })
})

describe("登记表", () => {
  it("每条要么有 key 要么有 prefix，且不重复", () => {
    const seen = new Set<string>()
    for (const entry of STORAGE_ENTRIES) {
      const identifier = entry.key ?? entry.prefix
      expect(identifier, JSON.stringify(entry)).toBeTruthy()
      expect(seen.has(identifier!), `重复登记：${identifier}`).toBe(false)
      seen.add(identifier!)
    }
  })

  /**
   * 代码里新加的存储键必须登记，否则「清除数据」会漏掉它，
   * 用户也无从知道站点在本地留了什么。
   */
  it("代码中出现的存储键都已登记", () => {
    const registered = new Set(
      STORAGE_ENTRIES.flatMap((entry) => [entry.key, entry.prefix].filter(Boolean) as string[]),
    )
    const roots = ["app", "components", "lib", "hooks"]
    const found = new Set<string>()

    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name)
        if (statSync(full).isDirectory()) {
          walk(full)
          continue
        }
        if (!/\.(ts|tsx)$/.test(name) || /\.test\.tsx?$/.test(name)) continue
        const source = readFileSync(full, "utf8")
        // const XXX_KEY = "literal"
        for (const match of source.matchAll(/const\s+[A-Z_]*(?:KEY|KEYS)\s*=\s*"([^"]+)"/g)) {
          found.add(match[1])
        }
        // 直接传字面量的调用
        for (const match of source.matchAll(
          /(?:read|write|remove)LocalStorage\(\s*"([^"]+)"|localStorage\.(?:get|set|remove)Item\(\s*"([^"]+)"/g,
        )) {
          found.add(match[1] ?? match[2])
        }
      }
    }
    roots.forEach(walk)

    // storage 层自身的示例与测试夹具不算
    const unregistered = [...found].filter(
      (key) => !registered.has(key) && !STORAGE_ENTRIES.some((e) => e.prefix && key.startsWith(e.prefix)),
    )
    expect(unregistered, "这些存储键还没在 STORAGE_ENTRIES 登记").toEqual([])
  })
})

describe("formatStorageSize", () => {
  it("按量级选择单位", () => {
    expect(formatStorageSize(512)).toBe("512 B")
    expect(formatStorageSize(2048)).toBe("2.0 KB")
    expect(formatStorageSize(3 * 1024 * 1024)).toBe("3.0 MB")
  })
})
