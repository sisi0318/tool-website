import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Page } from "@playwright/test"

import { TOOL_IDS } from "../lib/tools/catalog"

/**
 * axe-core 自动扫描:每个页面首屏不得有 WCAG 2.x A/AA 级的 serious / critical 违规。
 * 自动扫描抓不到键盘模型、焦点管理这类问题,那些由 components/m3 的单测与人工检查覆盖;
 * 它擅长的是缺少可访问名称、对比度、地标与 ARIA 属性用错这类批量问题。
 */
const CORE_PAGES = ["/", "/tools", "/canvas", "/journey", "/settings"]
const PAGES = [...CORE_PAGES, ...TOOL_IDS.map((id) => `/tools/${id}`)]

async function scan(page: Page, path: string) {
  await page.addInitScript(() => window.localStorage.setItem("locale", "zh"))
  await page.goto(path, { waitUntil: "domcontentloaded" })
  // 画布页没有标题元素,以 React Flow 的容器出现为准
  await expect(page.locator("h1, h2, .react-flow").first()).toBeVisible({ timeout: 30_000 })
  await page.waitForTimeout(300)

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze()

  return results.violations
    .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
    .map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      help: violation.help,
      nodes: violation.nodes.slice(0, 3).map((node) => ({
        target: node.target.join(" "),
        html: node.html.replace(/\s+/g, " ").slice(0, 160),
      })),
    }))
}

test.describe("无障碍自动扫描", () => {
  for (const path of PAGES) {
    test(`${path} 无 serious/critical 违规`, async ({ page }) => {
      const violations = await scan(page, path)
      expect(violations, JSON.stringify(violations, null, 2)).toEqual([])
    })
  }
})

// 深色主题另有一套色板,对比度问题两边各查各的
test.describe("无障碍自动扫描(深色主题)", () => {
  test.use({ colorScheme: "dark" })

  for (const path of PAGES) {
    test(`${path} 深色下无 serious/critical 违规`, async ({ page }) => {
      const violations = await scan(page, path)
      expect(violations, JSON.stringify(violations, null, 2)).toEqual([])
    })
  }
})
