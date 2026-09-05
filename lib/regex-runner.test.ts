import { describe, expect, it } from "vitest"

import {
  DEFAULT_MAX_MATCHES,
  RegexTimeoutError,
  isRegexWorkerAvailable,
  runRegex,
  runRegexSync,
} from "./regex-runner"

describe("runRegexSync", () => {
  it("全局匹配返回每个匹配的位置、分组与命名分组", () => {
    const result = runRegexSync("(?<word>\\w+)@(\\w+)", "g", "a@x b@y", undefined, 100)
    expect(result.matches).toHaveLength(2)
    expect(result.matches[0]).toMatchObject({
      index: 0,
      match: "a@x",
      groups: ["a", "x"],
      namedGroups: { word: "a" },
      length: 3,
    })
    expect(result.matches[1].index).toBe(4)
    expect(result.hitIterationLimit).toBe(false)
  })

  it("非全局只返回第一个匹配", () => {
    const result = runRegexSync("\\d", "", "a1b2", undefined, 100)
    expect(result.matches.map((m) => m.match)).toEqual(["1"])
  })

  it("零宽匹配不会原地打转", () => {
    const result = runRegexSync("", "g", "abc", undefined, 100)
    // 空串在每个位置（含末尾）都匹配一次，共 4 次
    expect(result.matches).toHaveLength(4)
    expect(result.hitIterationLimit).toBe(false)
  })

  it("匹配次数触顶时标记 hitIterationLimit", () => {
    const result = runRegexSync("a", "g", "a".repeat(50), undefined, 10)
    expect(result.matches).toHaveLength(10)
    expect(result.hitIterationLimit).toBe(true)
  })

  it("替换结果与 String.prototype.replace 一致，且不受前面 exec 推进的 lastIndex 影响", () => {
    const result = runRegexSync("o", "g", "foo boo", "0", 100)
    expect(result.replaced).toBe("f00 b00")
    expect(result.matches).toHaveLength(4)
  })

  it("非法正则抛出原生错误", () => {
    expect(() => runRegexSync("(", "g", "x", undefined, 100)).toThrow(SyntaxError)
  })

  /**
   * Worker 脚本是把这个函数 toString() 后塞进去的。这里用同样的方式取源码再
   * 求值，证明它确实自包含 —— 一旦有人在里面引用模块作用域的东西，这条会挂。
   */
  it("源码自包含：字符串化后重新求值与直接调用结果一致", () => {
    const rebuilt = new Function(`return (${runRegexSync.toString()})`)() as typeof runRegexSync
    const cases: Array<[string, string, string, string | undefined]> = [
      ["(?<w>\\w+)", "g", "hi there", undefined],
      ["o", "gi", "FOO boo", "0"],
      ["^$", "gm", "a\n\nb", undefined],
      ["x", "", "no match here", "y"],
    ]
    for (const [pattern, flags, text, replacement] of cases) {
      const a = runRegexSync(pattern, flags, text, replacement, DEFAULT_MAX_MATCHES)
      const b = rebuilt(pattern, flags, text, replacement, DEFAULT_MAX_MATCHES)
      expect(b.matches, pattern).toEqual(a.matches)
      expect(b.replaced, pattern).toEqual(a.replaced)
      expect(b.hitIterationLimit, pattern).toBe(a.hitIterationLimit)
    }
  })
})

describe("runRegex", () => {
  it("测试环境没有 Worker，退回主线程同步执行", async () => {
    expect(isRegexWorkerAvailable()).toBe(false)
    const result = await runRegex({ pattern: "b+", flags: "g", text: "abbbc" })
    expect(result.matches.map((m) => m.match)).toEqual(["bbb"])
  })

  it("退回路径下非法正则以 rejected promise 报错", async () => {
    await expect(runRegex({ pattern: "[", flags: "", text: "x" })).rejects.toThrow(SyntaxError)
  })

  it("超时错误可被识别", () => {
    const error = new RegexTimeoutError(2000)
    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe("RegexTimeoutError")
    expect(error.message).toMatch(/2000ms/)
  })
})
