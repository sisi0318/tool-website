import { expect, test } from "@playwright/test"

/**
 * 中英文案已按语言拆包：中文随首屏加载，英文只在用户真正切换时才请求。
 * 这条用例守住两件事 —— 首屏不下载英文包，切换后文案与 lang 属性都跟上。
 */
test.describe("语言切换", () => {
  test("首屏不加载英文包，切换后按需拉取并应用", async ({ page }) => {
    const chunkRequests: string[] = []
    page.on("request", (request) => {
      const url = request.url()
      if (url.includes("/_next/static/chunks/")) chunkRequests.push(url)
    })

    // 不预置 locale：默认就是中文，而 addInitScript 会在每次导航时重放，
    // 那样刷新后又会把切换结果覆盖掉
    await page.goto("/", { waitUntil: "networkidle" })

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 30_000 })
    await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN")

    const initialChunks = chunkRequests.length
    expect(initialChunks).toBeGreaterThan(0)

    // 切到英文
    await page.getByRole("button", { name: /切换语言|Switch language/ }).click()
    await page.getByRole("menuitem", { name: "English" }).click()

    // 文案与 lang 都要跟上
    await expect(page.locator("html")).toHaveAttribute("lang", "en", { timeout: 15_000 })
    await expect(page.getByRole("link", { name: /Explore|Tools/ }).first()).toBeVisible()

    // 切换过程中应当额外请求了语言包
    expect(chunkRequests.length).toBeGreaterThan(initialChunks)

    // 刷新后保持英文（从 localStorage 恢复并再次按需加载）
    await page.reload({ waitUntil: "domcontentloaded" })
    await expect(page.locator("html")).toHaveAttribute("lang", "en", { timeout: 15_000 })
  })
})
