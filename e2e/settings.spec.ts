import { expect, test } from "@playwright/test"

/**
 * 设置页要如实反映本站在这台设备上存了什么，并且真的能清掉。
 * 它同时是「本地处理、不上传」这一定位的兑现入口。
 */
test.describe("设置与本地数据", () => {
  test("列出已写入的数据并能按分组清除", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("locale", "zh")
      window.localStorage.setItem("tool_favorite_ids", '["hash","json"]')
      window.localStorage.setItem("canvas-state", '{"nodes":[],"edges":[]}')
      window.localStorage.setItem("totp_accounts", '[{"secret":"JBSWY3DPEHPK3PXP"}]')
      // 同域下的其它数据不该被本站的清除操作波及
      window.localStorage.setItem("unrelated-app", "keep me")
    })

    await page.goto("/settings", { waitUntil: "domcontentloaded" })
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 30_000 })

    // 三个分组都应列出，含敏感数据的要标出来
    await expect(page.getByRole("heading", { name: /工作台/ })).toBeVisible()
    await expect(page.getByRole("heading", { name: /工具画布/ })).toBeVisible()
    await expect(page.getByText("含敏感数据").first()).toBeVisible()

    // 清除画布分组
    const canvasSection = page.locator("li").filter({ hasText: "工具画布" })
    await canvasSection.getByRole("button", { name: "清除" }).click()
    await page.getByRole("button", { name: "确认清除" }).click()

    await expect(page.getByRole("heading", { name: /工具画布/ })).toHaveCount(0)
    await expect(page.getByRole("heading", { name: /工作台/ })).toBeVisible()

    const remaining = await page.evaluate(() => ({
      canvas: window.localStorage.getItem("canvas-state"),
      favorites: window.localStorage.getItem("tool_favorite_ids"),
      unrelated: window.localStorage.getItem("unrelated-app"),
    }))
    expect(remaining.canvas).toBeNull()
    expect(remaining.favorites).not.toBeNull()
    expect(remaining.unrelated).toBe("keep me")
  })

  test("清除全部后只留下同域的其它数据", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("locale", "zh")
      window.localStorage.setItem("tool_favorite_ids", '["hash"]')
      window.localStorage.setItem("journey-draft", '{"version":1}')
      window.localStorage.setItem("unrelated-app", "keep me")
    })

    await page.goto("/settings", { waitUntil: "domcontentloaded" })
    await page.getByRole("button", { name: "清除全部本地数据" }).click()
    await page.getByRole("button", { name: "确认清除" }).click()

    await expect(page.getByText("本站目前没有在这台设备上存任何数据。")).toBeVisible()

    const remaining = await page.evaluate(() => ({
      favorites: window.localStorage.getItem("tool_favorite_ids"),
      journey: window.localStorage.getItem("journey-draft"),
      unrelated: window.localStorage.getItem("unrelated-app"),
    }))
    expect(remaining.favorites).toBeNull()
    expect(remaining.journey).toBeNull()
    expect(remaining.unrelated).toBe("keep me")
  })
})
