import { expect, test } from "@playwright/test"

test.describe("全站搜索", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem("locale", "zh"))
  })

  test("在工具页按 Ctrl+K 搜索并打开另一个工具", async ({ page }) => {
    await page.goto("/tools/json", { waitUntil: "domcontentloaded" })
    const search = page.getByRole("combobox", { name: "搜索工具或功能…" })
    // 水合前按键没有监听，按到面板出现为止
    await expect(async () => {
      await page.keyboard.press("Control+k")
      await expect(search).toBeVisible({ timeout: 2000 })
    }).toPass()
    await search.fill("md5")
    await search.press("Enter")
    await expect(page).toHaveURL(/\/tools\/hash/)
  })

  test("独立工具页读取 ?feature= 参数", async ({ page }) => {
    await page.goto("/tools/json?feature=minify", { waitUntil: "domcontentloaded" })
    await expect(page.locator("#json-editor")).toHaveValue(/^\{"person":\{"name":/)
  })
})
