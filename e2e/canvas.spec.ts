import { test, expect, type Page } from "@playwright/test"

test.describe("Canvas Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/canvas")
    await page.waitForLoadState("networkidle")
    // generous: Next dev serves the canvas route unbundled, cold loads are slow
    await page.waitForSelector(".react-flow", { timeout: 30000 })
  })

  /** 节点库平时收着：点左侧竖栏的「搜索」展开整个库 */
  async function openLibrary(page: Page) {
    await page.getByRole("toolbar", { name: "节点库" }).getByRole("button", { name: "搜索", exact: true }).click()
    const library = page.getByRole("complementary", { name: "节点库" })
    await expect(library).toBeVisible()
    return library
  }

  test("should give the whole window to the canvas, with the chrome floating on top", async ({ page }) => {
    const viewport = page.viewportSize()!
    const canvas = await page.locator(".react-flow").boundingBox()
    expect(canvas).toMatchObject({ x: 0, y: 0, width: viewport.width, height: viewport.height })

    await expect(page.getByRole("button", { name: "工作流 · 未命名工作流", exact: true })).toBeVisible()
    await expect(page.getByRole("toolbar", { name: "画布操作栏" })).toBeVisible()
    await expect(page.getByRole("toolbar", { name: "视图操作栏" })).toBeVisible()
    await expect(page.getByRole("toolbar", { name: "节点库" })).toBeVisible()
    await expect(page.getByText("双击画布，添加节点")).toBeVisible()

    // 节点库和属性卡片都是用到才出现
    await expect(page.getByRole("complementary", { name: "节点库" })).toHaveCount(0)
    await expect(page.locator("section[data-canvas-shortcuts='off']")).toHaveCount(0)
  })

  test("should list a category beside the dock and put it away again", async ({ page }) => {
    const dock = page.getByRole("toolbar", { name: "节点库" })
    for (const category of ["基础", "加密", "数据", "图像", "文本", "开发", "工具", "查看"]) {
      await expect(dock.getByRole("button", { name: category, exact: true })).toBeVisible()
    }

    await dock.getByRole("button", { name: "加密", exact: true }).click()
    const library = page.getByRole("complementary", { name: "节点库" })
    await expect(library.getByRole("heading", { name: /^加密/ })).toBeVisible()
    await expect(library.getByRole("button", { name: "添加节点: 哈希计算", exact: true })).toBeVisible()
    // 只列这一类
    await expect(library.getByRole("button", { name: "添加节点: 文本", exact: true })).toHaveCount(0)

    await page.keyboard.press("Escape")
    await expect(library).toHaveCount(0)
    await expect(dock.getByRole("button", { name: "加密", exact: true })).toBeFocused()
  })

  test("should display basic nodes in palette", async ({ page }) => {
    const library = await openLibrary(page)
    await expect(library.locator("span:text('文本')").first()).toBeVisible()
    await expect(library.locator("span:text('数字')").first()).toBeVisible()
    await expect(library.locator("span:text('JSON')").first()).toBeVisible()
    await expect(library.locator("span:text('文件')").first()).toBeVisible()
  })

  test("should display crypto nodes in palette", async ({ page }) => {
    const library = await openLibrary(page)
    await expect(library.locator("span:text('哈希计算')").first()).toBeVisible()
    await expect(library.locator("span:text('编码解码')").first()).toBeVisible()
  })

  test("should display utility nodes in palette", async ({ page }) => {
    const library = await openLibrary(page)
    await expect(library.locator("span:text('UUID 生成')")).toBeVisible()
    await expect(library.locator("span:text('进制转换')")).toBeVisible()
    await expect(library.locator("span:text('温度转换')")).toBeVisible()
  })

  test("should zoom from the percentage menu and show the minimap on request", async ({ page }) => {
    await expect(page.locator(".react-flow")).toBeVisible()
    // 小地图默认收着
    await expect(page.locator(".react-flow__minimap")).toHaveCount(0)
    await page.getByRole("button", { name: "小地图", exact: true }).click()
    await expect(page.locator(".react-flow__minimap")).toBeVisible()
    await page.getByRole("button", { name: "小地图", exact: true }).click()
    await expect(page.locator(".react-flow__minimap")).toHaveCount(0)

    await page.evaluate(() => {
      (window as any).__ZUSTAND_STORE__.getState().addNode({ id: "zoom-node", type: "string", position: { x: 300, y: 200 }, config: { value: "x" } })
    })
    await expect(page.locator(".react-flow__node")).toHaveCount(1)
    const zoom = () => page.evaluate(() => (window as any).__REACT_FLOW_INSTANCE__.getZoom())

    await page.getByRole("button", { name: /^缩放 \d+%$/ }).click()
    await page.getByRole("menuitem", { name: "200%", exact: true }).click()
    await expect.poll(zoom).toBe(2)
    await expect(page.getByRole("button", { name: "缩放 200%", exact: true })).toBeVisible()

    // Shift+1：适应画布内容。只有一个节点时不会为了“铺满”把它放大过 100%
    await page.keyboard.press("Shift+Digit1")
    await expect.poll(zoom).toBe(1)
    const node = (await page.locator(".react-flow__node").boundingBox())!
    const viewport = page.viewportSize()!
    expect(node.x).toBeGreaterThan(0)
    expect(node.x + node.width).toBeLessThan(viewport.width)
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
    await expect(nodes.first()).toContainText("文本")
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
    await expect(node).toContainText("文本")

    const input = node.getByRole("textbox", { name: "Value" })
    await expect(input).toBeVisible()
    await expect(input).toHaveValue("hello")
  })

  test("selecting text inside a node input does not drag the node", async ({ page }) => {
    await page.evaluate(() => {
      const store = (window as any).__ZUSTAND_STORE__
      store.getState().addNode({
        id: "drag-guard-node",
        type: "string",
        position: { x: 300, y: 200 },
        config: { value: "select this text" },
      })
    })

    const node = page.locator('.react-flow__node[data-id="drag-guard-node"]')
    const input = node.getByRole("textbox", { name: "Value" })
    await expect(input).toBeVisible()
    const box = (await input.boundingBox())!
    await page.mouse.move(box.x + 6, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width - 6, box.y + box.height / 2 + 40, { steps: 8 })
    await page.mouse.up()

    const position = await page.evaluate(() => {
      const store = (window as any).__ZUSTAND_STORE__
      return store.getState().nodes.find((candidate: { id: string }) => candidate.id === "drag-guard-node").position
    })
    expect(position).toEqual({ x: 300, y: 200 })
  })

  test("Backspace after clicking the property panel does not delete the node", async ({ page }) => {
    await page.evaluate(() => {
      const store = (window as any).__ZUSTAND_STORE__
      store.getState().addNode({ id: "panel-guard-node", type: "string", position: { x: 300, y: 200 }, config: { value: "keep" } })
      store.getState().selectNode("panel-guard-node")
    })
    // 节点库里“文本”也是分类标题，限定在属性面板里
    const heading = page.locator("section[aria-label='文本']").getByRole("heading", { name: "文本", exact: true })
    await expect(heading).toBeVisible()
    await heading.click()
    await page.keyboard.press("Backspace")
    await page.keyboard.press("Delete")

    const exists = await page.evaluate(() => {
      const store = (window as any).__ZUSTAND_STORE__
      return store.getState().nodes.some((candidate: { id: string }) => candidate.id === "panel-guard-node")
    })
    expect(exists).toBe(true)
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
    await expect(node).toContainText("数字")

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
    // 中文界面里节点名也是中文（lib/translations 的 nodes.*）
    const expectedTools = [
      "文本", "数字", "JSON", "文件",
      "哈希计算", "HMAC 计算", "加密解密", "编码解码", "经典密码", "JWT 解析",
      "JSON 格式化", "Protobuf 解析", "JCE 解析",
      "图片转 Base64", "EXIF 查看", "图片压缩", "图片编辑",
      "二维码生成", "二维码解码", "智能切图", "坐标拾取",
      "文本统计", "大小写转换", "正则表达式", "文本对比",
      "HTTP 请求", "Crontab 表达式", "Docker 转换", "WHOIS 查询",
      "UUID 生成", "TOTP 验证码", "颜色", "进制转换", "温度转换", "汇率转换", "BMI 计算",
      "设备信息", "Office 预览", "时间"
    ]

    const library = await openLibrary(page)
    for (const tool of expectedTools) {
      await expect(library.locator(`span:text('${tool}')`).first()).toBeVisible()
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
    // the far node is out of sight (an empty canvas no longer re-centres on the first node
    // added to it); pin the camera to the origin so the paste assertion is deterministic
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

  test("should open node search from the keyboard and add the best match", async ({ page }) => {
    await page.keyboard.press("Control+k")
    const search = page.getByRole("searchbox", { name: "搜索节点…" })
    await expect(search).toBeFocused()

    await search.fill("Hash")
    await search.press("Enter")

    await expect(page.locator(".react-flow__node")).toHaveCount(1, { timeout: 5000 })
    const state = await page.evaluate(() => {
      const store = (window as any).__ZUSTAND_STORE__.getState()
      return {
        type: store.nodes[0]?.type,
        recent: JSON.parse(localStorage.getItem("canvas-recent-nodes") ?? "[]"),
      }
    })
    expect(state.type).toBe("hash")
    expect(state.recent[0]).toBe("hash")
  })

  test("should append and connect a compatible node from the palette", async ({ page }) => {
    await page.evaluate(() => {
      const store = (window as any).__ZUSTAND_STORE__.getState()
      store.setAutoRun(false)
      store.addNode({
        id: "append-source",
        type: "string",
        position: { x: 120, y: 220 },
        config: { value: "hello" },
      })
    })

    // 选中了节点时，节点库里每个接得上的节点多一个“加在后面并连好线”的按钮
    await page.getByRole("toolbar", { name: "节点库" }).getByRole("button", { name: "加密", exact: true }).click()
    await expect(page.getByText(/从「文本」继续/)).toBeVisible()
    await page.getByRole("button", {
      name: "添加到已选节点后并连接: 哈希计算",
      exact: true,
    }).click()

    await expect(page.locator(".react-flow__node")).toHaveCount(2, { timeout: 5000 })
    const graph = await page.evaluate(() => {
      const store = (window as any).__ZUSTAND_STORE__.getState()
      return { nodes: store.nodes, edges: store.edges }
    })
    expect(graph.nodes.find((node: any) => node.type === "hash")).toMatchObject({
      position: { x: 480, y: 220 },
    })
    expect(graph.edges).toEqual([
      expect.objectContaining({
        source: "append-source",
        sourcePort: "value",
        targetPort: "data",
      }),
    ])
  })

  test("should bypass a disabled node and step through the workflow", async ({ page }) => {
    await page.evaluate(() => {
      const store = (window as any).__ZUSTAND_STORE__.getState()
      store.setAutoRun(false)
      store.addSubgraph({
        nodes: [
          {
            id: "step-source",
            type: "string",
            position: { x: 120, y: 220 },
            config: { value: "raw input" },
          },
          {
            id: "step-hash",
            type: "hash",
            position: { x: 500, y: 220 },
            config: { algorithm: "sha256", outputFormat: "hex" },
          },
        ],
        edges: [{
          id: "step-edge",
          source: "step-source",
          sourcePort: "value",
          target: "step-hash",
          targetPort: "data",
        }],
      })
      store.selectNodes([])
    })

    const hashNode = page.locator('.react-flow__node[data-id="step-hash"]')
    await hashNode.getByRole("button", { name: "临时停用节点" }).click()
    await expect(hashNode.locator('[data-node-disabled="true"]')).toBeVisible()

    await page.getByRole("button", { name: "单步执行下一个节点" }).click()
    await page.getByRole("button", { name: "单步执行下一个节点" }).click()

    await page.waitForFunction(() => {
      const state = (window as any).__ZUSTAND_STORE__.getState()
      return state.stepProgress.current === 2 && state.executionLog.length === 2
    })
    const result = await page.evaluate(() => {
      const state = (window as any).__ZUSTAND_STORE__.getState()
      return {
        output: state.nodeOutputs["step-hash"]?.hash,
        statuses: state.executionLog.map((entry: any) => entry.status),
      }
    })
    expect(result.output).toBe("raw input")
    expect(result.statuses).toEqual(["success", "skipped"])
    await expect(page.getByText("单步 2/2", { exact: true })).toBeVisible()
  })

  test("should save the current workflow with Ctrl+S and flag later edits", async ({ page }) => {
    await page.evaluate(() => {
      (window as any).__ZUSTAND_STORE__.getState().addNode({
        id: "save-node",
        type: "string",
        position: { x: 300, y: 200 },
        config: { value: "hello" },
      })
    })
    await expect(page.locator(".react-flow__node")).toHaveCount(1, { timeout: 5000 })

    await page.keyboard.press("Control+s")
    const dialog = page.getByRole("dialog", { name: "保存工作流" })
    await dialog.getByPlaceholder("输入工作流名字").fill("日报")
    await dialog.getByRole("button", { name: "确认" }).click()
    await expect(dialog).not.toBeVisible()
    await expect(page.getByText("已保存“日报”", { exact: true })).toBeVisible()

    const header = page.getByRole("button", { name: /工作流 · 日报/ })
    await expect(header).toBeVisible()
    await expect(header).not.toContainText("有未保存的修改")

    await page.evaluate(() => {
      (window as any).__ZUSTAND_STORE__.getState().updateNodePosition("save-node", { x: 420, y: 200 })
    })
    await expect(header).toContainText("有未保存的修改")

    await page.keyboard.press("Control+s")
    await expect(dialog).not.toBeVisible()
    await expect(header).not.toContainText("有未保存的修改")
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("WORKFLOW_日报") ?? "null"))
    expect(saved?.nodes?.[0]?.position).toEqual({ x: 420, y: 200 })
  })

  test("should keep the enhanced palette usable on a phone viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.reload()
    await page.waitForSelector(".react-flow", { timeout: 30000 })

    await page.getByRole("button", { name: "节点库" }).click()
    const palette = page.getByRole("complementary", { name: "节点库" })
    await expect(palette).toBeVisible()

    const bounds = await palette.boundingBox()
    expect(bounds).not.toBeNull()
    expect(bounds!.width).toBeLessThanOrEqual(344)
    expect(bounds!.height).toBeLessThanOrEqual(844)

    const search = page.getByRole("searchbox", { name: "搜索节点…" })
    await search.fill("Hash")
    await search.press("Enter")

    await expect(palette).not.toBeVisible()
    await expect(page.locator(".react-flow__node")).toHaveCount(1, { timeout: 5000 })
    // 手机上选中节点不会自己弹出属性抽屉：它盖住大半屏，会挡着节点旁边的工具条和“+”
    const sheet = page.locator("section[aria-label='哈希计算']")
    await expect(page.locator(".react-flow__node.selected")).toHaveCount(1)
    await expect(sheet).toHaveCount(0)
    const toolbar = page.getByRole("toolbar", { name: "节点操作" })
    await expect(toolbar).toBeInViewport()
    await expect(page.getByRole("button", { name: "添加下一步节点", exact: true })).toBeInViewport()

    // 从工具条上点开；关掉以后节点仍然选中
    await toolbar.getByRole("button", { name: "属性", exact: true }).click()
    await expect(sheet.getByRole("heading", { name: "哈希计算", exact: true })).toBeVisible()
    await sheet.getByRole("button", { name: "关闭", exact: true }).click()
    await expect(sheet).toHaveCount(0)
    await expect(page.locator(".react-flow__node.selected")).toHaveCount(1)

    const reopenPalette = page.getByRole("button", { name: "节点库" })
    await expect(reopenPalette).toBeVisible()
    await reopenPalette.click()
    await expect(palette).toBeVisible()
    await expect(page.getByText(/从「哈希计算」继续/)).toBeVisible()
  })

  test("should fit the top bar on a phone without squeezing out the workflow name", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.reload()
    await page.waitForSelector(".react-flow", { timeout: 30000 })

    const name = page.getByRole("button", { name: "工作流 · 未命名工作流", exact: true })
    const label = name.getByText("未命名工作流", { exact: true })
    // 文字没有被截断
    expect(await label.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)

    const header = (await name.boundingBox())!
    const runBar = (await page.getByRole("toolbar", { name: "画布操作栏" }).boundingBox())!
    expect(header.x + header.width).toBeLessThanOrEqual(runBar.x)
    expect(runBar.x + runBar.width).toBeLessThanOrEqual(390)

    // 单步和自动运行在手机上收进菜单
    await expect(page.getByRole("button", { name: "单步执行下一个节点" })).toHaveCount(0)
    await page.getByRole("button", { name: "更多运行选项" }).click()
    await expect(page.getByRole("menuitem", { name: "单步执行下一个节点" })).toBeVisible()
    const autoRun = page.getByRole("menuitemcheckbox", { name: "自动运行" })
    await expect(autoRun).toBeChecked()
    await autoRun.click()
    expect(await page.evaluate(() => (window as any).__ZUSTAND_STORE__.getState().autoRun)).toBe(false)
  })
})

test.describe("Canvas interactions", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/canvas")
    await page.waitForLoadState("networkidle")
    await page.waitForSelector(".react-flow", { timeout: 30000 })
    await page.waitForFunction(() => Boolean((window as any).__REACT_FLOW_INSTANCE__))
  })

  const state = (page: Page) =>
    page.evaluate(() => {
      const store = (window as any).__ZUSTAND_STORE__.getState()
      return {
        nodes: store.nodes as Array<{ id: string; type: string; position: { x: number; y: number }; disabled?: boolean }>,
        edges: store.edges as Array<{ source: string; sourcePort: string; target: string; targetPort: string }>,
        selected: store.selectedNodeIds as string[],
      }
    })

  /** 把镜头定在原点，后面按屏幕坐标操作才对得上 */
  async function pinViewport(page: Page) {
    await page.evaluate(() => (window as any).__REACT_FLOW_INSTANCE__.setViewport({ x: 0, y: 0, zoom: 1 }))
    await page.waitForTimeout(150)
  }

  /** 放一个没选中的文本节点 */
  async function seedTextNode(page: Page, id = "seed", position = { x: 300, y: 240 }) {
    await page.evaluate(({ id, position }) => {
      const store = (window as any).__ZUSTAND_STORE__.getState()
      store.setAutoRun(false)
      store.addNode({ id, type: "string", position, config: { value: "hello" } })
      store.selectNodes([])
    }, { id, position })
    await expect(page.locator(`.react-flow__node[data-id="${id}"]`)).toBeVisible()
    await pinViewport(page)
  }

  test("double-clicking the canvas adds the chosen node where the click was", async ({ page }) => {
    await page.evaluate(() => (window as any).__REACT_FLOW_INSTANCE__.setViewport({ x: 0, y: 0, zoom: 1 }))
    await page.mouse.dblclick(520, 360)

    const search = page.getByRole("combobox", { name: "添加节点" })
    await expect(search).toBeFocused()
    await search.fill("哈希计算")
    await expect(page.getByRole("option").first()).toHaveText(/哈希计算/)
    await search.press("Enter")

    await expect(page.getByTestId("quick-add-menu")).toHaveCount(0)
    await expect(page.locator(".react-flow__node")).toHaveCount(1)
    const { nodes, selected } = await state(page)
    expect(nodes[0]).toMatchObject({ type: "hash", position: { x: 520, y: 360 } })
    expect(selected).toEqual([nodes[0].id])
    // 节点就落在双击的地方：镜头没有为了“适应”第一个节点而挪走，双击也没有顺带把画布放大
    await page.waitForTimeout(400)
    expect(await page.evaluate(() => (window as any).__REACT_FLOW_INSTANCE__.getViewport())).toEqual({ x: 0, y: 0, zoom: 1 })
    const box = (await page.locator(".react-flow__node").boundingBox())!
    expect(Math.round(box.x)).toBe(520)
    expect(Math.round(box.y)).toBe(360)
    // 用过的节点记进“最近使用”
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("canvas-recent-nodes") ?? "[]")[0])).toBe("hash")
  })

  test("the quick add menu closes on Escape and double-clicking a node does not open it", async ({ page }) => {
    await seedTextNode(page)
    await page.locator('.react-flow__node[data-id="seed"]').dblclick({ position: { x: 40, y: 14 } })
    await expect(page.getByTestId("quick-add-menu")).toHaveCount(0)

    await page.mouse.dblclick(900, 560)
    await expect(page.getByTestId("quick-add-menu")).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(page.getByTestId("quick-add-menu")).toHaveCount(0)
    expect((await state(page)).nodes).toHaveLength(1)
  })

  test("the selected node gets a toolbar: duplicate, bypass, hide the properties, delete", async ({ page }) => {
    await seedTextNode(page)
    await page.locator('.react-flow__node[data-id="seed"]').click({ position: { x: 40, y: 14 } })
    const toolbar = page.getByRole("toolbar", { name: "节点操作" })
    await expect(toolbar).toBeVisible()

    // 属性卡片跟着选中出现，关掉以后节点还是选中的，工具条上能再打开
    const inspector = page.locator("section[aria-label='文本']")
    await expect(inspector).toBeVisible()
    await toolbar.getByRole("button", { name: "属性", exact: true }).click()
    await expect(inspector).toHaveCount(0)
    await expect(page.locator(".react-flow__node.selected")).toHaveCount(1)
    await toolbar.getByRole("button", { name: "属性", exact: true }).click()
    await expect(inspector).toBeVisible()
    await inspector.getByRole("button", { name: "关闭", exact: true }).click()
    await expect(inspector).toHaveCount(0)
    await expect(toolbar.getByRole("button", { name: "属性", exact: true })).toHaveAttribute("aria-pressed", "false")

    await toolbar.getByRole("button", { name: "临时停用节点", exact: true }).click()
    expect((await state(page)).nodes[0].disabled).toBe(true)
    await toolbar.getByRole("button", { name: "重新启用节点", exact: true }).click()
    expect((await state(page)).nodes[0].disabled).toBeFalsy()

    await toolbar.getByRole("button", { name: "创建副本", exact: true }).click()
    await expect(page.locator(".react-flow__node")).toHaveCount(2)
    const copy = await state(page)
    expect(copy.nodes[1].position).toEqual({ x: 340, y: 280 })
    // 副本成了选中的那个，工具条跟过去
    expect(copy.selected).toEqual([copy.nodes[1].id])

    await toolbar.getByRole("button", { name: "删除节点", exact: true }).click()
    await expect(page.locator(".react-flow__node")).toHaveCount(1)
    expect((await state(page)).nodes[0].id).toBe("seed")
    await expect(toolbar).toHaveCount(0)

    // 删除可以撤销
    await page.keyboard.press("Control+z")
    await expect(page.locator(".react-flow__node")).toHaveCount(2)
  })

  test("the + beside a node adds the next step, wired to its result", async ({ page }) => {
    await page.evaluate(() => {
      const store = (window as any).__ZUSTAND_STORE__.getState()
      store.setAutoRun(false)
      store.addNode({ id: "encode", type: "encoding", position: { x: 200, y: 200 }, config: { encoding: "base64", mode: "encode" } })
    })
    await expect(page.locator('.react-flow__node[data-id="encode"]')).toBeVisible()
    await pinViewport(page)

    await page.getByRole("button", { name: "添加下一步节点", exact: true }).click()
    const picker = page.getByTestId("compatible-node-picker")
    await expect(picker).toBeVisible()
    await picker.getByRole("button", { name: "添加并连接: 哈希计算", exact: true }).click()

    await expect(page.locator(".react-flow__node")).toHaveCount(2)
    const first = await state(page)
    const hash = first.nodes.find((node) => node.type === "hash")!
    // 连的是运算结果 output，不是能往外连的参数 encoding / mode
    expect(first.edges).toEqual([
      expect.objectContaining({ source: "encode", sourcePort: "output", target: hash.id, targetPort: "data" }),
    ])
    expect(hash.position.y).toBe(200)
    expect(hash.position.x).toBeGreaterThan(200 + 280)
    // 新节点成了选中的那个，可以接着往下加
    expect(first.selected).toEqual([hash.id])

    // 同一个节点再分一支：排在已有下游的下面，不叠在一起
    await page.evaluate(() => (window as any).__ZUSTAND_STORE__.getState().selectNodes(["encode"]))
    await page.getByRole("button", { name: "添加下一步节点", exact: true }).click()
    await picker.getByRole("button", { name: "添加并连接: 文本统计", exact: true }).click()
    await expect(page.locator(".react-flow__node")).toHaveCount(3)
    const second = await state(page)
    const stats = second.nodes.find((node) => node.type !== "hash" && node.id !== "encode")!
    expect(stats.position.x).toBe(hash.position.x)
    expect(stats.position.y).toBeGreaterThan(hash.position.y + 100)
    expect(second.edges).toHaveLength(2)
  })

  test("a node hidden behind the properties card is moved clear of it when selected", async ({ page }) => {
    const viewport = page.viewportSize()!
    // 放在右上角：属性卡片正好盖在它上面
    await seedTextNode(page, "tucked", { x: viewport.width - 300, y: 140 })
    await page.evaluate(() => (window as any).__ZUSTAND_STORE__.getState().selectNodes(["tucked"]))

    const inspector = page.locator("section[aria-label='文本']")
    await expect(inspector).toBeVisible()
    await expect.poll(async () => {
      const node = (await page.locator('.react-flow__node[data-id="tucked"]').boundingBox())!
      const card = (await inspector.boundingBox())!
      return node.x + node.width < card.x
    }).toBe(true)
    await expect(page.getByRole("button", { name: "添加下一步节点", exact: true })).toBeInViewport()
    // 挪的是镜头，不是节点
    expect((await state(page)).nodes[0].position).toEqual({ x: viewport.width - 300, y: 140 })
  })

  test("right-clicking the canvas offers add, paste and select all at that spot", async ({ page }) => {
    await seedTextNode(page)
    await page.locator('.react-flow__node[data-id="seed"]').click({ position: { x: 40, y: 14 } })
    await page.keyboard.press("Control+c")

    await page.mouse.click(820, 520, { button: "right" })
    const menu = page.getByRole("menu", { name: "画布菜单" })
    await expect(menu).toBeVisible()
    await menu.getByRole("menuitem", { name: /^粘贴/ }).click()
    await expect(page.locator(".react-flow__node")).toHaveCount(2)
    // 粘贴在右键的位置，而不是视口中央
    expect((await state(page)).nodes[1].position).toEqual({ x: 820, y: 520 })

    await page.mouse.click(820, 300, { button: "right" })
    await menu.getByRole("menuitem", { name: /^全选/ }).click()
    expect((await state(page)).selected).toHaveLength(2)
    await expect(page.getByRole("toolbar", { name: "批量节点操作" })).toBeVisible()

    await page.mouse.click(600, 600, { button: "right" })
    await menu.getByRole("menuitem", { name: "添加节点", exact: true }).click()
    await expect(page.getByRole("combobox", { name: "添加节点" })).toBeFocused()
    await page.keyboard.press("Escape")

    // 没复制过东西时“粘贴”是灰的。重新进入页面后节点会被收进视野中间，挑底边的空白处点
    await page.reload()
    await page.waitForSelector(".react-flow")
    await expect(page.locator(".react-flow__node")).toHaveCount(2)
    await page.mouse.click(1000, 690, { button: "right" })
    await expect(menu.getByRole("menuitem", { name: /^粘贴/ })).toBeDisabled()
    await page.keyboard.press("Escape")
    await expect(menu).toHaveCount(0)
  })

  test("right-clicking a node selects it and acts on it; inside a selection it acts on all of them", async ({ page }) => {
    await seedTextNode(page, "first", { x: 300, y: 240 })
    await seedTextNode(page, "second", { x: 700, y: 240 })

    const second = page.locator('.react-flow__node[data-id="second"]')
    await second.click({ button: "right", position: { x: 40, y: 14 } })
    const menu = page.getByRole("menu", { name: "节点菜单" })
    await expect(menu).toBeVisible()
    expect((await state(page)).selected).toEqual(["second"])
    await menu.getByRole("menuitem", { name: "临时停用节点", exact: true }).click()
    expect((await state(page)).nodes.find((node) => node.id === "second")!.disabled).toBe(true)

    // 菜单随节点状态变：已停用的节点给的是“重新启用”
    await second.click({ button: "right", position: { x: 40, y: 14 } })
    await expect(menu.getByRole("menuitem", { name: "重新启用节点", exact: true })).toBeVisible()
    await menu.getByRole("menuitem", { name: /^删除/ }).click()
    await expect(page.locator(".react-flow__node")).toHaveCount(1)

    await page.keyboard.press("Control+z")
    await expect(page.locator(".react-flow__node")).toHaveCount(2)
    await page.evaluate(() => (window as any).__ZUSTAND_STORE__.getState().selectNodes(["first", "second"]))
    await page.locator('.react-flow__node[data-id="first"]').click({ button: "right", position: { x: 40, y: 14 } })
    // 多选时没有只对单个节点有意义的项
    await expect(menu.getByRole("menuitem", { name: "运行到此节点" })).toHaveCount(0)
    await menu.getByRole("menuitem", { name: /^创建副本/ }).click()
    await expect(page.locator(".react-flow__node")).toHaveCount(4)
  })

  test("dragging with the right button still pans instead of opening a menu", async ({ page }) => {
    await seedTextNode(page)
    await page.mouse.move(820, 520)
    await page.mouse.down({ button: "right" })
    await page.mouse.move(700, 440, { steps: 6 })
    await page.mouse.up({ button: "right" })

    await expect(page.getByRole("menu")).toHaveCount(0)
    const viewport = await page.evaluate(() => (window as any).__REACT_FLOW_INSTANCE__.getViewport())
    expect(viewport.x).toBeLessThan(0)
    expect(viewport.y).toBeLessThan(0)
  })

  test("edges stay faint until one of their nodes is selected", async ({ page }) => {
    await page.evaluate(() => {
      const store = (window as any).__ZUSTAND_STORE__.getState()
      store.setAutoRun(false)
      store.addSubgraph({
        nodes: [
          { id: "a", type: "string", position: { x: 100, y: 200 }, config: { value: "x" } },
          { id: "b", type: "hash", position: { x: 520, y: 200 }, config: {} },
          { id: "c", type: "string", position: { x: 100, y: 460 }, config: { value: "y" } },
          { id: "d", type: "hash", position: { x: 520, y: 460 }, config: {} },
        ],
        edges: [
          { id: "ab", source: "a", sourcePort: "value", target: "b", targetPort: "data" },
          { id: "cd", source: "c", sourcePort: "value", target: "d", targetPort: "data" },
        ],
      })
      store.selectNodes([])
    })
    const opacity = (id: string) =>
      page.locator(`.react-flow__edge[data-id="${id}"] .react-flow__edge-path`).evaluate((path) => Number(getComputedStyle(path).strokeOpacity))
    await expect(page.locator(".react-flow__edge")).toHaveCount(2)
    await expect.poll(() => opacity("ab")).toBeLessThan(0.6)
    await expect.poll(() => opacity("cd")).toBeLessThan(0.6)

    await page.evaluate(() => (window as any).__ZUSTAND_STORE__.getState().selectNodes(["b"]))
    await expect.poll(() => opacity("ab")).toBe(1)
    await expect.poll(() => opacity("cd")).toBeLessThan(0.6)
  })

  test("the workflow menu clears the canvas only after confirming, and it can be undone", async ({ page }) => {
    await seedTextNode(page)
    const trigger = page.getByRole("button", { name: /^工作流 · / })
    await trigger.click()
    await page.getByRole("menuitem", { name: "清空画布", exact: true }).click()
    const dialog = page.getByRole("alertdialog", { name: "清空画布" })
    await expect(dialog).toBeVisible()
    await dialog.getByRole("button", { name: "取消" }).click()
    await expect(page.locator(".react-flow__node")).toHaveCount(1)

    await trigger.click()
    await page.getByRole("menuitem", { name: "清空画布", exact: true }).click()
    await dialog.getByRole("button", { name: "清空", exact: true }).click()
    await expect(page.locator(".react-flow__node")).toHaveCount(0)
    await expect(page.getByText("双击画布，添加节点")).toBeVisible()

    await page.keyboard.press("Control+z")
    await expect(page.locator(".react-flow__node")).toHaveCount(1)
  })

  test("the workflow dialogs dim the page behind them and take the keyboard focus", async ({ page }) => {
    await seedTextNode(page)
    await page.getByRole("button", { name: /^工作流 · / }).click()
    await page.getByRole("menuitem", { name: /^另存为/ }).click()
    const dialog = page.getByRole("dialog", { name: "保存工作流" })
    await expect(dialog).toBeVisible()
    // 输入框拿到焦点，没有被刚关掉的菜单抢回去
    await expect(dialog.getByPlaceholder("输入工作流名字")).toBeFocused()
    // 以前遮罩的类名编译不出任何样式，对话框后面是原样的画布
    const scrim = await dialog.evaluate((element) => getComputedStyle(element.parentElement!).backgroundColor)
    expect(scrim).toBe("rgba(0, 0, 0, 0.5)")
    // 遮罩铺满整个窗口
    const overlay = await dialog.evaluate((element) => {
      const bounds = element.parentElement!.getBoundingClientRect()
      return { width: bounds.width, height: bounds.height }
    })
    expect(overlay).toEqual(page.viewportSize())
  })
})
