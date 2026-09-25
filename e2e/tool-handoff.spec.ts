import { expect, test, type Page } from "@playwright/test"

/**
 * 工作台里“继续处理”：发往另一个工具时就地开标签，发往旅程时开新的浏览器标签，
 * 两种情况下原来标签里的输入和结果都还在（以前会整页跳走，工作台全部清空）。
 */
async function csvToJsonInWorkspace(page: Page) {
  await page.goto("/tools?tool=csv", { waitUntil: "domcontentloaded" })
  const input = page.locator("[data-workbench-input]")
  // 页面可能还没水合完，先于水合的操作会被重置：切到“格式转换”、填到值保持住为止
  await expect(async () => {
    await page.getByRole("radio", { name: "格式转换" }).click()
    await input.fill("a,b\n1,2")
    await expect(input).toHaveValue("a,b\n1,2", { timeout: 1000 })
  }).toPass()
  await input.press("Control+Enter")
  await expect(page.getByRole("button", { name: "继续处理 · CSV / TSV 工具" })).toBeEnabled()
  return input
}

test.describe("跨工具继续处理", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem("locale", "zh"))
  })

  test("在工作台里发往另一个工具时就地开标签，原标签保留", async ({ page }) => {
    const input = await csvToJsonInWorkspace(page)
    await page.getByRole("button", { name: "继续处理 · CSV / TSV 工具" }).click()
    await page.getByRole("menuitem", { name: "在工具中打开…" }).click()
    await page.getByRole("dialog").getByRole("button", { name: "JSON工具" }).click()

    await expect(page).toHaveURL(/\/tools/)
    await expect(page.locator("#json-editor")).toHaveValue(/"a": 1/)
    await page.getByRole("tab", { name: /CSV/ }).click()
    await expect(input).toHaveValue("a,b\n1,2")
  })

  test("在工作台里发往旅程时在新标签打开，数据跟过去", async ({ page, context }) => {
    const input = await csvToJsonInWorkspace(page)
    await page.getByRole("button", { name: "继续处理 · CSV / TSV 工具" }).click()
    const [journey] = await Promise.all([
      context.waitForEvent("page"),
      page.getByRole("menuitem", { name: "在数据旅程中继续" }).click(),
    ])
    await journey.waitForLoadState("domcontentloaded")
    await expect(journey.locator("pre", { hasText: '"a": 1' })).toBeVisible()

    await expect(page).toHaveURL(/\/tools/)
    await expect(input).toHaveValue("a,b\n1,2")
  })
})
