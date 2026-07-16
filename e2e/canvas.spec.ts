import { test, expect } from "@playwright/test"

test.describe("Canvas Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/canvas")
    await page.waitForLoadState("networkidle")
    // generous: Next dev serves the canvas route unbundled, cold loads are slow
    await page.waitForSelector(".react-flow", { timeout: 30000 })
  })

  test("should display canvas page with all panels", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "节点", exact: true })).toBeVisible()
    await expect(page.locator("text=选择节点以编辑")).toBeVisible()
  })

  test("should display node palette with categories", async ({ page }) => {
    for (const category of ["基础", "加密", "数据", "工具"]) {
      await expect(
        page.getByRole("heading", { name: category, exact: true })
      ).toBeVisible()
    }
  })

  test("should display basic nodes in palette", async ({ page }) => {
    await expect(page.locator("span:text('String')").first()).toBeVisible()
    await expect(page.locator("span:text('Number')").first()).toBeVisible()
    await expect(page.locator("span:text('JSON')").first()).toBeVisible()
    await expect(page.locator("span:text('File')").first()).toBeVisible()
  })

  test("should display crypto nodes in palette", async ({ page }) => {
    await expect(page.locator("span:text('Hash')").first()).toBeVisible()
    await expect(page.locator("span:text('Encoding')").first()).toBeVisible()
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
          position: { x: 100, y: 200 },
          config: { value: "hello" },
        })
        state.addNode({
          id: "test-hash-node",
          type: "hash",
          position: { x: 500, y: 200 },
          config: { algorithm: "sha256" },
        })
      }
    })

    await page.waitForTimeout(1000)

    const nodes = page.locator(".react-flow__node")
    await expect(nodes).toHaveCount(2, { timeout: 5000 })

    const sourceHandle = page.locator(
      '.react-flow__node[data-id="test-string-node"] .react-flow__handle[data-handleid="value"][data-handlepos="right"]'
    )
    const targetHandle = page.locator(
      '.react-flow__node[data-id="test-hash-node"] .react-flow__handle[data-handleid="data"]'
    )

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

    const node = page.locator('.react-flow__node[data-id="test-string-node"]')
    await expect(node).toContainText("String")

    const input = node.getByRole("textbox", { name: "Value" })
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

    const node = page.locator('.react-flow__node[data-id="test-number-node"]')
    await expect(node).toContainText("Number")

    const input = node.getByRole("spinbutton", { name: "Value" })
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

    const node = page.locator('.react-flow__node[data-id="test-json-node"]')
    await expect(node).toContainText("JSON")

    const textarea = node.getByRole("textbox", { name: "Value" })
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
          targetPort: "value",
        })
      }
    })

    await page.waitForTimeout(1000)

    const targetNode = page.locator('.react-flow__node[data-id="test-string-target"]')
    const input = targetNode.getByRole("textbox", { name: "Value" })
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

  test("should select and delete an edge with the Delete key", async ({ page }) => {
    await page.evaluate(() => {
      const store = (window as any).__ZUSTAND_STORE__
      if (store) {
        const state = store.getState()
        state.addNode({
          id: "del-src",
          type: "string",
          position: { x: 100, y: 200 },
          config: { value: "hello" },
        })
        state.addNode({
          id: "del-dst",
          type: "hash",
          position: { x: 520, y: 280 },
          config: { algorithm: "sha256" },
        })
        state.addEdge({
          id: "del-edge",
          source: "del-src",
          sourcePort: "value",
          target: "del-dst",
          targetPort: "data",
        })
      }
    })

    // a bezier between same-height nodes has a zero-height bounding box,
    // so assert attachment instead of visibility
    const edge = page.locator('.react-flow__edge[data-id="del-edge"]')
    await expect(edge).toBeAttached({ timeout: 5000 })

    await page.locator('.react-flow__edge[data-id="del-edge"] .react-flow__edge-interaction').click()
    await expect(edge).toHaveClass(/selected/)

    await page.keyboard.press("Delete")
    await expect(page.locator(".react-flow__edge")).toHaveCount(0)

    const remaining = await page.evaluate(
      () => (window as any).__ZUSTAND_STORE__.getState().edges.length
    )
    expect(remaining).toBe(0)

    // nodes must survive edge deletion
    await expect(page.locator(".react-flow__node")).toHaveCount(2)

    // undo restores the edge
    await page.keyboard.press("Control+z")
    await expect(page.locator(".react-flow__edge")).toHaveCount(1, { timeout: 5000 })
  })

  test("should marquee-select nodes by dragging on the pane", async ({ page }) => {
    await page.evaluate(() => {
      const store = (window as any).__ZUSTAND_STORE__
      if (store) {
        const state = store.getState()
        state.addNode({
          id: "mq-1",
          type: "string",
          position: { x: 100, y: 150 },
          config: { value: "a" },
        })
        state.addNode({
          id: "mq-2",
          type: "string",
          position: { x: 500, y: 300 },
          config: { value: "b" },
        })
      }
    })

    await expect(page.locator(".react-flow__node")).toHaveCount(2, { timeout: 5000 })

    const pane = page.locator(".react-flow__pane")
    const box = await pane.boundingBox()
    expect(box).not.toBeNull()

    // start in empty space clear of the bottom-left controls, drag over both nodes
    const startX = box!.x + 120
    const startY = box!.y + box!.height - 120
    const endX = box!.x + box!.width - 60
    const endY = box!.y + 60

    await page.mouse.move(startX, startY)
    await page.mouse.down()
    await page.mouse.move(endX, endY, { steps: 12 })

    await expect(page.locator(".react-flow__selection")).toBeVisible()

    await page.mouse.up()
    await expect(page.locator(".react-flow__node.selected")).toHaveCount(2, { timeout: 5000 })
  })

  test("should paste copied nodes inside the visible viewport", async ({ page }) => {
    // ReactFlow is mounted with fitView, so the camera follows seeded nodes;
    // pin it back to the origin to make the paste assertion deterministic
    await page.waitForFunction(
      () => Boolean((window as any).__REACT_FLOW_INSTANCE__)
    )

    await page.evaluate(() => {
      const store = (window as any).__ZUSTAND_STORE__
      if (store) {
        const state = store.getState()
        state.addNode({
          id: "far-node",
          type: "string",
          position: { x: 5000, y: 5000 },
          config: { value: "far away" },
        })
        state.selectNodes(["far-node"])
      }
    })

    await expect(page.locator(".react-flow__node")).toHaveCount(1, { timeout: 5000 })

    await page.evaluate(
      () =>
        (window as any).__REACT_FLOW_INSTANCE__.setViewport({
          x: 0,
          y: 0,
          zoom: 1,
        })
    )
    await page.waitForTimeout(300)

    await page.keyboard.press("Control+c")
    await page.keyboard.press("Control+v")

    await expect(page.locator(".react-flow__node")).toHaveCount(2, { timeout: 5000 })

    const viewport = page.viewportSize()!
    let insideCount = 0
    for (const node of await page.locator(".react-flow__node").all()) {
      const bb = await node.boundingBox()
      if (!bb) continue
      const fullyVisible =
        bb.x >= 0 &&
        bb.y >= 0 &&
        bb.x + bb.width <= viewport.width &&
        bb.y + bb.height <= viewport.height
      if (fullyVisible) insideCount++
    }

    // the copy of the off-screen node must land in view (previously it pasted at the original coordinates)
    expect(insideCount).toBe(1)
  })
})
