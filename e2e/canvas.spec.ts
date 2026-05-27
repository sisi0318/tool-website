import { test, expect } from "@playwright/test"

test.describe("Canvas Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/canvas")
    await page.waitForLoadState("networkidle")
    await page.waitForSelector(".react-flow", { timeout: 15000 })
  })

  test("should display canvas page with all panels", async ({ page }) => {
    await expect(page.locator("h3:text('Nodes')")).toBeVisible()
    await expect(page.locator("text=Select a node to edit")).toBeVisible()
  })

  test("should display node palette with categories", async ({ page }) => {
    await expect(page.locator("h4:text('Basic')")).toBeVisible()
    await expect(page.locator("h4:text('Crypto')")).toBeVisible()
    await expect(page.locator("h4:text('Utility')")).toBeVisible()
  })

  test("should display basic nodes in palette", async ({ page }) => {
    await expect(page.locator("span:text('String')").first()).toBeVisible()
    await expect(page.locator("span:text('Number')").first()).toBeVisible()
    await expect(page.locator("span:text('JSON')").first()).toBeVisible()
    await expect(page.locator("span:text('File')").first()).toBeVisible()
  })

  test("should display crypto nodes in palette", async ({ page }) => {
    await expect(page.locator("span:text('Hash')")).toBeVisible()
    await expect(page.locator("span:text('Encoding')")).toBeVisible()
  })

  test("should display utility nodes in palette", async ({ page }) => {
    await expect(page.locator("span:text('UUID')")).toBeVisible()
    await expect(page.locator("span:text('Base Converter')")).toBeVisible()
    await expect(page.locator("span:text('Temperature')")).toBeVisible()
  })

  test("should have ReactFlow canvas with controls", async ({ page }) => {
    const canvas = page.locator(".react-flow")
    await expect(canvas).toBeVisible()
    await expect(page.locator(".react-flow__controls")).toBeVisible()
    await expect(page.locator(".react-flow__minimap")).toBeVisible()
  })
})
