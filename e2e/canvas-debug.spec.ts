import { test, expect } from "@playwright/test"

test("capture canvas page logs and screenshot", async ({ page }) => {
  const logs: string[] = []
  page.on("console", (msg) => logs.push(`[${msg.type()}] ${msg.text()}`))
  page.on("pageerror", (err) => logs.push(`[ERROR] ${err.message}`))

  await page.goto("/canvas")
  await page.waitForTimeout(5000)

  console.log("=== Console Logs ===")
  logs.forEach((log) => console.log(log))

  await page.screenshot({ path: "test-results/canvas-debug.png", fullPage: true })
})
