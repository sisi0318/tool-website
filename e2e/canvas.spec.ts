import { test, expect } from "@playwright/test"

test.describe("Canvas Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/canvas")
    await page.waitForLoadState("networkidle")
  })

  test("should display canvas page with all panels", async ({ page }) => {
    await expect(page.locator("text=Nodes")).toBeVisible()
    await expect(page.locator("text=Select a node to edit")).toBeVisible()
  })

  test("should display node palette with categories", async ({ page }) => {
    await expect(page.locator("text=Basic")).toBeVisible()
    await expect(page.locator("text=Crypto")).toBeVisible()
    await expect(page.locator("text=Utility")).toBeVisible()
  })

  test("should display basic nodes in palette", async ({ page }) => {
    await expect(page.locator("text=String").first()).toBeVisible()
    await expect(page.locator("text=Number").first()).toBeVisible()
    await expect(page.locator("text=JSON").first()).toBeVisible()
    await expect(page.locator("text=File").first()).toBeVisible()
  })

  test("should display crypto nodes in palette", async ({ page }) => {
    await expect(page.locator("text=Hash")).toBeVisible()
    await expect(page.locator("text=Encoding")).toBeVisible()
  })

  test("should display utility nodes in palette", async ({ page }) => {
    await expect(page.locator("text=UUID")).toBeVisible()
    await expect(page.locator("text=Base Converter")).toBeVisible()
    await expect(page.locator("text=Temperature")).toBeVisible()
  })

  test("should have ReactFlow canvas with controls", async ({ page }) => {
    const canvas = page.locator(".react-flow")
    await expect(canvas).toBeVisible()
    await expect(page.locator(".react-flow__controls")).toBeVisible()
    await expect(page.locator(".react-flow__minimap")).toBeVisible()
  })
})
