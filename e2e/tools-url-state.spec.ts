import { expect, test } from "@playwright/test"

/**
 * 工作台类工具(UtilityWorkbench)的 URL 状态:
 * 链接里的 ?op= 与 ?input= 在打开时生效,切换操作会把 op 写回 URL(默认操作不写)。
 */
test.describe("工具页 URL 状态", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem("locale", "zh"))
  })

  test("从链接读取操作与输入,切换操作后写回 URL", async ({ page }) => {
    const input = "a,b\n1,2"
    await page.goto(`/tools/csv?op=to-tsv&input=${encodeURIComponent(input)}`, { waitUntil: "domcontentloaded" })

    const operation = page.locator("#utility-workbench-operation")
    await expect(operation).toContainText("转为 TSV")
    await expect(page.locator("#utility-workbench-input")).toHaveValue(input)

    // 切到非默认操作:URL 跟着变
    await operation.click()
    await page.getByRole("option", { name: "JSON 转 CSV" }).click()
    await expect.poll(() => new URL(page.url()).searchParams.get("op")).toBe("from-json")

    // 切回默认操作:参数被清掉,输入不会被写进 URL
    await operation.click()
    await page.getByRole("option", { name: "CSV 转 JSON" }).click()
    await expect.poll(() => new URL(page.url()).searchParams.get("op")).toBeNull()
    expect(new URL(page.url()).searchParams.get("input")).toBe(input)
  })

  test("过长的 input 参数被忽略", async ({ page }) => {
    await page.goto(`/tools/csv?input=${encodeURIComponent("x".repeat(5000))}`, { waitUntil: "domcontentloaded" })
    await expect(page.locator("#utility-workbench-operation")).toBeVisible()
    await expect(page.locator("#utility-workbench-input")).toHaveValue("")
  })
})
