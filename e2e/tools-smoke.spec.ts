import { expect, test } from "@playwright/test"

import { TOOL_IDS } from "../lib/tools/catalog"

/**
 * 每个工具页的最低要求:能打开、渲染出标题、挂载后没有未捕获的运行时错误。
 * 路由列表直接取自工具目录,新增工具自动纳入,不必再手工登记。
 */
test.describe("工具页冒烟", () => {
  for (const id of TOOL_IDS) {
    test(`/tools/${id} 能打开且无运行时错误`, async ({ page }) => {
      const runtimeErrors: string[] = []
      page.on("pageerror", (error) => runtimeErrors.push(error.message))
      await page.addInitScript(() => window.localStorage.setItem("locale", "zh"))

      const response = await page.goto(`/tools/${id}`, { waitUntil: "domcontentloaded" })
      expect(response?.status(), "HTTP 状态").toBeLessThan(400)
      await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 30_000 })

      // 工具组件是动态加载的,标题先于组件出现;留一点时间让挂载阶段的错误冒出来
      await page.waitForTimeout(500)
      expect(runtimeErrors, "页面运行时错误").toEqual([])
    })
  }
})
