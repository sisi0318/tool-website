import { expect, test } from "@playwright/test"

/**
 * 用户正则在 Worker 里执行并带超时。这条用例用一个经典的灾难性回溯模式
 * 验证：页面在几秒内给出超时错误，而不是整个标签页冻结。
 */
test.describe("正则工具", () => {
  test("灾难性回溯不再冻结页面，超时后给出可读错误", async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem("locale", "zh"))
    await page.goto("/tools/regex", { waitUntil: "domcontentloaded" })
    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 30_000 })

    // (a+)+$ 对「一长串 a 加一个不匹配字符」是指数级回溯
    await page.locator("textarea").first().fill("a".repeat(40) + "!")
    await page.getByPlaceholder("输入正则表达式").fill("(a+)+$")

    // 超时设定 2 秒；若正则仍在主线程跑，下面这句 evaluate 根本回不来
    const started = Date.now()
    await expect
      .poll(async () => page.evaluate(() => 1 + 1), { timeout: 5_000 })
      .toBe(2)

    await expect(page.getByText(/正则执行超时/)).toBeVisible({ timeout: 10_000 })
    expect(Date.now() - started).toBeLessThan(10_000)

    // 恢复正常表达式后仍能工作：Worker 被杀掉后要能重建
    await page.getByPlaceholder("输入正则表达式").fill("a+")
    await expect(page.getByText(/正则执行超时/)).toHaveCount(0, { timeout: 5_000 })
    await expect(page.getByText(/匹配/).first()).toBeVisible()
  })
})
