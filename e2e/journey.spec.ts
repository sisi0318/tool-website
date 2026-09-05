import { expect, test, type Page } from "@playwright/test"

async function startJourney(page: Page, text: string) {
  await page.getByRole("textbox", { name: "从一份数据开始" }).fill(text)
  await page.getByRole("button", { name: "开始探索" }).click()
}

/** 当前值卡片里的正文;识别芯片也会写出类似「plain text」的字样,所以只认 <pre> */
function valueCard(page: Page, text: string) {
  return page.locator("pre", { hasText: text })
}

test.describe("数据旅程", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem("locale", "zh"))
  })

  test("替换当前旅程前区分已保存与未保存", async ({ page }) => {
    await page.goto("/journey", { waitUntil: "domcontentloaded" })
    await startJourney(page, "aGVsbG8gd29ybGQ=")
    await page.getByRole("button", { name: /Base64 decode/ }).first().click()
    await expect(valueCard(page, "hello world")).toBeVisible()

    // 未保存:新建要先确认
    await page.getByRole("button", { name: "新建", exact: true }).click()
    await expect(page.getByRole("dialog", { name: "新建旅程" })).toBeVisible()
    await page.getByRole("button", { name: "取消", exact: true }).click()
    await expect(page.getByRole("dialog")).toHaveCount(0)

    // 保存后与存档一致:新建直接执行
    await page.getByRole("button", { name: "保存", exact: true }).click()
    await expect(page.getByText("已保存")).toBeVisible()
    await page.getByRole("button", { name: "新建", exact: true }).click()
    await expect(page.getByRole("button", { name: "开始探索" })).toBeVisible()
    await expect(page.getByRole("dialog")).toHaveCount(0)

    // 新的未保存旅程上打开存档:确认嵌在对话框里,取消回到列表
    await startJourney(page, "plain text")
    await page.getByRole("button", { name: "打开旅程", exact: true }).click()
    const dialog = page.getByRole("dialog", { name: "打开旅程" })
    const savedEntry = dialog.getByRole("button", { name: "未命名旅程", exact: true })
    await savedEntry.click()
    await expect(dialog.getByText(/打开「未命名旅程」会替换当前旅程/)).toBeVisible()
    await dialog.getByRole("button", { name: "取消", exact: true }).click()
    await expect(savedEntry).toBeVisible()
    await expect(valueCard(page, "plain text")).toBeVisible()

    await savedEntry.click()
    await dialog.getByRole("button", { name: "替换并打开" }).click()
    await expect(page.getByRole("dialog")).toHaveCount(0)
    await expect(valueCard(page, "hello world")).toBeVisible()
  })

  test("分享链接与本地草稿并存时可以放弃导入恢复草稿", async ({ page }) => {
    await page.goto("/journey", { waitUntil: "domcontentloaded" })
    await startJourney(page, "draft-data-123")
    await expect(valueCard(page, "draft-data-123")).toBeVisible()
    // 自动保存带 500ms 防抖
    await page.waitForFunction(() => window.localStorage.getItem("journey-draft") !== null)

    const payload = {
      v: 1,
      name: "shared",
      steps: [{ tool: "encoding", config: { encoding: "base64", mode: "decode" }, outputPort: "output" }],
    }
    const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url")
    // 同一页面上只改 hash 是片段导航,不会重新挂载;先离开再带链接进来
    await page.goto("about:blank")
    await page.goto(`/journey#j=${encoded}`, { waitUntil: "domcontentloaded" })

    await expect(page.getByText(/已从分享链接导入 1 步/)).toBeVisible()
    await expect(page.getByText("本地还有一份未保存的旅程草稿")).toBeVisible()
    await page.getByRole("button", { name: "放弃导入，恢复草稿" }).click()

    await expect(valueCard(page, "draft-data-123")).toBeVisible()
    await expect(page.getByText(/已从分享链接导入/)).toHaveCount(0)
  })
})
