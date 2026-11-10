import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Page } from "@playwright/test"

async function startJourney(page: Page, text: string) {
  const input = page.getByRole("textbox", { name: "从一份数据开始" })
  const start = page.getByRole("button", { name: "开始探索" })
  // 页面可能还没水合：先于水合的输入会被 React 重置，按钮一直禁用。填到按钮可用为止
  await expect(async () => {
    await input.fill(text)
    await expect(start).toBeEnabled({ timeout: 1000 })
  }).toPass()
  await start.click()
}

/** 保存、打开、新建收在标题栏的“更多操作”菜单里 */
async function chooseAction(page: Page, name: string) {
  await page.getByRole("button", { name: "更多操作" }).click()
  await page.getByRole("menuitem", { name, exact: true }).click()
}

/** 步骤列表里的各步,从“输入”开始 */
function steps(page: Page) {
  return page.locator("[data-journey-step]")
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
    await page.getByRole("button", { name: /Base64 解码/ }).first().click()
    await expect(valueCard(page, "hello world")).toBeVisible()

    // 未保存:新建要先确认
    await chooseAction(page, "新建")
    await expect(page.getByRole("dialog", { name: "新建旅程" })).toBeVisible()
    await page.getByRole("button", { name: "取消", exact: true }).click()
    await expect(page.getByRole("dialog")).toHaveCount(0)

    // 保存后与存档一致:新建直接执行
    await chooseAction(page, "保存")
    await expect(page.getByText("已保存")).toBeVisible()
    await chooseAction(page, "新建")
    await expect(page.getByRole("button", { name: "开始探索" })).toBeVisible()
    await expect(page.getByRole("dialog")).toHaveCount(0)

    // 新的未保存旅程上打开存档:确认嵌在对话框里,取消回到列表
    await startJourney(page, "plain text")
    await chooseAction(page, "打开旅程")
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

  test("用默认名保存第二份旅程时先确认覆盖", async ({ page }) => {
    await page.goto("/journey", { waitUntil: "domcontentloaded" })
    await startJourney(page, "first journey")
    await chooseAction(page, "保存")
    await expect(page.getByText("已保存")).toBeVisible()

    // 已保存的旅程新建时不追问;新旅程沿用默认名再保存就会撞名
    await chooseAction(page, "新建")
    await startJourney(page, "second journey")
    await chooseAction(page, "保存")
    const dialog = page.getByRole("dialog", { name: "覆盖同名旅程" })
    await expect(dialog).toBeVisible()
    await dialog.getByRole("button", { name: "取消", exact: true }).click()
    await expect(dialog).toHaveCount(0)

    await chooseAction(page, "保存")
    await page.getByRole("dialog", { name: "覆盖同名旅程" }).getByRole("button", { name: "覆盖", exact: true }).click()
    await expect(page.getByText("已保存").last()).toBeVisible()

    // 覆盖之后就是自己的存档了,再保存不再追问
    await chooseAction(page, "保存")
    await expect(page.getByRole("dialog")).toHaveCount(0)
  })

  test("回头看前面的步骤时后面的步骤还在,参数就地改,从中间继续会另开一条路", async ({ page }) => {
    await page.goto("/journey", { waitUntil: "domcontentloaded" })
    // base64 of {"a":1,"b":[2,3]}
    await startJourney(page, "eyJhIjoxLCJiIjpbMiwzXX0=")
    await page.getByRole("button", { name: /Base64 解码/ }).first().click()
    await expect(valueCard(page, '{"a":1,"b":[2,3]}')).toBeVisible()
    await page.getByRole("button", { name: /格式化 JSON/ }).first().click()
    await page.getByRole("button", { name: /计算哈希/ }).first().click()

    // 每一步写的是做了什么,不是工具名
    await expect(steps(page)).toHaveCount(4)
    await expect(steps(page).nth(1)).toContainText("Base64 解码")
    await expect(steps(page).nth(1)).toContainText("JSON")
    await expect(steps(page).nth(3)).toContainText("计算哈希")

    // 回头看第 2 步:它的结果出来了,第 3、4 步仍然列着
    await steps(page).nth(1).click()
    await expect(valueCard(page, '{"a":1,"b":[2,3]}')).toBeVisible()
    await expect(steps(page)).toHaveCount(4)
    await expect(steps(page).nth(1)).toHaveAttribute("aria-current", "step")

    // 第 4 步换一种算法:不弹面板,结果和步骤名跟着变
    await steps(page).nth(3).click()
    const md5 = await page.locator("pre").first().innerText()
    expect(md5).toMatch(/^[0-9a-f]{32}$/)
    await page.getByRole("combobox", { name: "Category" }).selectOption("sha2")
    await expect(page.locator("pre").first()).toHaveText(/^[0-9a-f]{56}$/)
    await expect(steps(page).nth(3)).toContainText("SHA-2-224")
    await expect(page.getByRole("dialog")).toHaveCount(0)

    // 从第 2 步另走一条路:屏幕上换成新的这条,分叉处有标记,原来那条在分支里
    await steps(page).nth(1).click()
    await expect(page.getByText("从这里继续会另开一条路")).toBeVisible()
    await page.getByRole("button", { name: /JSON 转 YAML/ }).first().click()
    await expect(steps(page)).toHaveCount(3)
    await expect(steps(page).nth(2)).toContainText("JSON 转 YAML")
    await page.getByRole("button", { name: "这里还有 1 条路" }).click()
    const branches = page.getByRole("dialog", { name: "探索分支" })
    await expect(branches).toContainText("SHA-2-224")

    // 刷新后还是这条路、这一步
    await page.keyboard.press("Escape")
    await expect(branches).toHaveCount(0)
    await steps(page).nth(1).click()
    await page.waitForFunction(() => window.localStorage.getItem("journey-draft")?.includes("tipId") === true)
    await page.reload({ waitUntil: "domcontentloaded" })
    await expect(steps(page)).toHaveCount(3)
    await expect(steps(page).nth(1)).toHaveAttribute("aria-current", "step")
  })

  for (const theme of ["light", "dark"] as const) {
    test(`步骤视图在${theme === "light" ? "浅色" : "深色"}主题下没有 serious / critical 的无障碍问题`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme })
      await page.goto("/journey", { waitUntil: "domcontentloaded" })
      // 扫描时关掉过渡:按钮从禁用恢复的那一瞬间颜色还没到位,会被当成对比度不足(见 a11y.spec.ts)
      await page.addStyleTag({ content: "*, *::before, *::after { transition: none !important; animation: none !important; }" })
      await startJourney(page, "eyJhIjoxLCJiIjpbMiwzXX0=")
      await page.getByRole("button", { name: /Base64 解码/ }).first().click()
      await page.getByRole("button", { name: /计算哈希/ }).first().click()
      await expect(steps(page)).toHaveCount(3)
      // 回到中间一步:选中态、分叉提示、参数表单、建议都在屏幕上
      await steps(page).nth(1).click()
      await page.getByRole("button", { name: /JSON 转 YAML/ }).first().click()
      await steps(page).nth(1).click()
      await expect(page.getByRole("button", { name: "这里还有 1 条路" })).toBeVisible()
      await page.waitForTimeout(300)

      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()
      const blocking = results.violations
        .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
        .map((violation) => ({ id: violation.id, nodes: violation.nodes.slice(0, 3).map((node) => `${node.target.join(" ")} :: ${node.failureSummary?.replace(/\s+/g, " ").slice(0, 220)}`) }))
      expect(blocking).toEqual([])
    })
  }

  test("更多工具把合适的排在前面", async ({ page }) => {
    await page.goto("/journey", { waitUntil: "domcontentloaded" })
    await startJourney(page, '{"a":1}')
    await page.getByRole("button", { name: "更多工具" }).click()
    const dialog = page.getByRole("dialog", { name: "选择工具" })
    const recommended = dialog.getByRole("region", { name: "推荐" })
    await expect(recommended.getByRole("button").first()).toContainText("JSON")
    await expect(dialog.getByRole("region", { name: "其他工具" })).toBeVisible()
    // 汇率、温度这类和 JSON 无关的工具不在推荐里
    await expect(recommended.getByRole("button", { name: /汇率|温度/ })).toHaveCount(0)

    // 搜索时合成一个列表,回车选第一个
    await dialog.getByRole("textbox", { name: "搜索工具…" }).fill("yaml")
    await page.keyboard.press("Enter")
    await expect(dialog).toHaveCount(0)
    await expect(steps(page).nth(1)).toContainText("YAML")
  })

  test.describe("手机上的弹层", () => {
    test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

    test("工具选择器贴底展开成抽屉", async ({ page }) => {
      await page.goto("/journey", { waitUntil: "domcontentloaded" })
      await startJourney(page, "hello")
      await page.getByRole("button", { name: "更多工具" }).click()

      const dialog = page.getByRole("dialog")
      await expect(dialog).toBeVisible()
      // 入场动画结束后再量
      await page.waitForTimeout(400)
      const box = await dialog.boundingBox()
      expect(box).not.toBeNull()
      expect(box!.x).toBe(0)
      expect(box!.width).toBe(390)
      expect(Math.round(box!.y + box!.height)).toBe(844)
    })

    test("选中那一步的详情展开在它下面,后面的步骤排在详情之后", async ({ page }) => {
      await page.goto("/journey", { waitUntil: "domcontentloaded" })
      await page.addStyleTag({ content: "html { scroll-behavior: auto !important; }" })
      await startJourney(page, "aGVsbG8gd29ybGQ=")
      await page.getByRole("button", { name: /Base64 解码/ }).first().click()
      await page.getByRole("button", { name: /计算哈希/ }).first().click()
      await expect(steps(page)).toHaveCount(3)

      await steps(page).nth(1).click()
      const detail = valueCard(page, "hello world")
      await expect(detail).toBeVisible()
      const [selected, value, next] = await Promise.all([steps(page).nth(1).boundingBox(), detail.boundingBox(), steps(page).nth(2).boundingBox()])
      expect(selected!.y).toBeLessThan(value!.y)
      expect(value!.y).toBeLessThan(next!.y)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      expect(overflow).toBeLessThanOrEqual(1)
    })
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

    // 已经停在页面上时粘贴链接只会改 hash:同样要进入导入流程,且当前旅程仍可恢复
    await page.evaluate((hash) => {
      window.location.hash = hash
    }, `#j=${encoded}`)
    await expect(page.getByText(/已从分享链接导入 1 步/)).toBeVisible()
    await expect(page.getByText("本地还有一份未保存的旅程草稿")).toBeVisible()
    await page.getByRole("button", { name: "放弃导入，恢复草稿" }).click()
    await expect(valueCard(page, "draft-data-123")).toBeVisible()
  })
})
