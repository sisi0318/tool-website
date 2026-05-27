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

  test("should add node to canvas via store", async ({ page }) => {
    await page.evaluate(() => {
      const store = (window as any).__ZUSTAND_STORE__
      if (store) {
        store.getState().addNode({
          id: "test-string-node",
          type: "string",
          position: { x: 300, y: 200 },
          config: { value: "hello" },
        })
      }
    })

    await page.waitForTimeout(1000)

    const nodes = page.locator(".react-flow__node")
    await expect(nodes).toHaveCount(1, { timeout: 5000 })
    await expect(nodes.first()).toContainText("String")
  })

  test("should connect two nodes via ports", async ({ page }) => {
    await page.evaluate(() => {
      const store = (window as any).__ZUSTAND_STORE__
      if (store) {
        const state = store.getState()
        state.addNode({
          id: "test-string-node",
          type: "string",
          position: { x: 200, y: 200 },
          config: { value: "hello" },
        })
        state.addNode({
          id: "test-hash-node",
          type: "hash",
          position: { x: 400, y: 200 },
          config: { algorithm: "sha256" },
        })
      }
    })

    await page.waitForTimeout(1000)

    const nodes = page.locator(".react-flow__node")
    await expect(nodes).toHaveCount(2, { timeout: 5000 })

    const handles = page.locator(".react-flow__handle")
    await expect(handles.first()).toBeVisible()

    const sourceHandle = page.locator(".react-flow__handle[data-handlepos='right']").first()
    const targetHandle = page.locator(".react-flow__handle[data-handlepos='left']").first()

    await expect(sourceHandle).toBeVisible()
    await expect(targetHandle).toBeVisible()

    const sourceBox = await sourceHandle.boundingBox()
    const targetBox = await targetHandle.boundingBox()

    expect(sourceBox).not.toBeNull()
    expect(targetBox).not.toBeNull()

    const startX = sourceBox!.x + sourceBox!.width / 2
    const startY = sourceBox!.y + sourceBox!.height / 2
    const endX = targetBox!.x + targetBox!.width / 2
    const endY = targetBox!.y + targetBox!.height / 2

    await page.mouse.move(startX, startY)
    await page.mouse.down()

    for (let i = 1; i <= 10; i++) {
      await page.mouse.move(
        startX + (endX - startX) * (i / 10),
        startY + (endY - startY) * (i / 10),
        { steps: 1 }
      )
      await page.waitForTimeout(50)
    }

    await page.mouse.up()
    await page.waitForTimeout(500)

    const edges = page.locator(".react-flow__edge")
    await expect(edges).toHaveCount(1, { timeout: 5000 })
  })
})
