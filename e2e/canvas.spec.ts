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
    await expect(page.locator("h4:text('Data')")).toBeVisible()
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

  test("should display inline editor for string node", async ({ page }) => {
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

    const node = page.locator(".react-flow__node").first()
    await expect(node).toContainText("String")
    
    const input = node.locator("[data-testid='string-input']")
    await expect(input).toBeVisible()
    await expect(input).toHaveValue("hello")
  })

  test("should display inline editor for number node", async ({ page }) => {
    await page.evaluate(() => {
      const store = (window as any).__ZUSTAND_STORE__
      if (store) {
        store.getState().addNode({
          id: "test-number-node",
          type: "number",
          position: { x: 300, y: 200 },
          config: { value: 42 },
        })
      }
    })

    await page.waitForTimeout(1000)

    const node = page.locator(".react-flow__node").first()
    await expect(node).toContainText("Number")
    
    const input = node.locator("[data-testid='number-input']")
    await expect(input).toBeVisible()
    await expect(input).toHaveValue("42")
  })

  test("should display inline editor for json node", async ({ page }) => {
    await page.evaluate(() => {
      const store = (window as any).__ZUSTAND_STORE__
      if (store) {
        store.getState().addNode({
          id: "test-json-node",
          type: "json",
          position: { x: 300, y: 200 },
          config: { value: '{"key": "value"}' },
        })
      }
    })

    await page.waitForTimeout(1000)

    const node = page.locator(".react-flow__node").first()
    await expect(node).toContainText("JSON")
    
    const textarea = node.locator("[data-testid='json-textarea']")
    await expect(textarea).toBeVisible()
    await expect(textarea).toHaveValue('{"key": "value"}')
  })

  test("should disable inline editor when input is connected", async ({ page }) => {
    await page.evaluate(() => {
      const store = (window as any).__ZUSTAND_STORE__
      if (store) {
        const state = store.getState()
        state.addNode({
          id: "test-string-source",
          type: "string",
          position: { x: 200, y: 200 },
          config: { value: "hello" },
        })
        state.addNode({
          id: "test-string-target",
          type: "string",
          position: { x: 400, y: 200 },
          config: { value: "" },
        })
        state.addEdge({
          id: "test-edge",
          source: "test-string-source",
          sourcePort: "value",
          target: "test-string-target",
          targetPort: "input",
        })
      }
    })

    await page.waitForTimeout(1000)

    const targetNode = page.locator(".react-flow__node").nth(1)
    const input = targetNode.locator("[data-testid='string-input']")
    await expect(input).toBeDisabled()
  })

  test("should display all 34 tools in palette", async ({ page }) => {
    const expectedTools = [
      "String", "Number", "JSON", "File",
      "Hash", "HMAC", "Crypto", "Encoding", "Classic Cipher", "JWT",
      "JSON Format", "Protobuf", "JCE",
      "Image to Base64", "EXIF Viewer", "Image Compress", "Image Editor", 
      "QRCode", "QRCode Decode", "Meme Splitter", "Image Coordinates",
      "Text Stats", "Case Converter", "Regex", "Diff",
      "HTTP Tester", "Crontab", "Docker Converter", "Whois",
      "UUID", "TOTP", "Color", "Base Converter", "Temperature", "Currency", "BMI",
      "Device Info", "Office Viewer", "Time"
    ]

    for (const tool of expectedTools) {
      await expect(page.locator(`span:text('${tool}')`).first()).toBeVisible()
    }
  })
})
