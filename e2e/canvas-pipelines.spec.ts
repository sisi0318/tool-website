import { test, expect, type Page } from "@playwright/test"

let nodeCounter = 0

function uniqueId(prefix: string) {
  return `${prefix}-${++nodeCounter}`
}

async function addNode(page: Page, type: string, config: Record<string, unknown> = {}): Promise<string> {
  const id = uniqueId(type)
  await page.evaluate(({ id, type, config }) => {
    const store = (window as any).__ZUSTAND_STORE__
    store.getState().addNode({ id, type, position: { x: 300 + Math.random() * 200, y: 200 + Math.random() * 200 }, config })
  }, { id, type, config })
  await page.waitForTimeout(300)
  return id
}

async function connectNodes(page: Page, sourceId: string, sourcePort: string, targetId: string, targetPort: string) {
  await page.evaluate(({ s, sp, t, tp }) => {
    const store = (window as any).__ZUSTAND_STORE__
    store.getState().addEdge({ id: `edge-${s}-${sp}-${t}-${tp}`, source: s, sourcePort: sp, target: t, targetPort: tp })
  }, { s: sourceId, sp: sourcePort, t: targetId, tp: targetPort })
  await page.waitForTimeout(200)
}

async function executeAll(page: Page) {
  await page.evaluate(() => {
    const store = (window as any).__ZUSTAND_STORE__
    return store.getState().executeAll()
  })
  await page.waitForTimeout(500)
}

async function getOutput(page: Page, nodeId: string, portId: string): Promise<unknown> {
  return page.evaluate(({ nodeId, portId }) => {
    const store = (window as any).__ZUSTAND_STORE__
    return store.getState().nodeOutputs[nodeId]?.[portId]
  }, { nodeId, portId })
}

test.describe("Pipeline: Deterministic Output", () => {
  test.beforeEach(async ({ page }) => {
    nodeCounter = 0
    await page.goto("/canvas")
    await page.waitForLoadState("networkidle")
    await page.waitForSelector(".react-flow", { timeout: 15000 })
  })

  test("String('1') → Hash(MD5) → String", async ({ page }) => {
    const src = await addNode(page, "string", { value: "1" })
    const hash = await addNode(page, "hash", { algorithm: "md5" })
    const out = await addNode(page, "string", { value: "" })
    await connectNodes(page, src, "value", hash, "data")
    await connectNodes(page, hash, "hash", out, "input")
    await executeAll(page)
    expect(await getOutput(page, out, "value")).toBe("c4ca4238a0b923820dcc509a6f75849b")
  })

  test("String('hello') → Hash(SHA-256) → String", async ({ page }) => {
    const src = await addNode(page, "string", { value: "hello" })
    const hash = await addNode(page, "hash", { algorithm: "sha256" })
    const out = await addNode(page, "string", { value: "" })
    await connectNodes(page, src, "value", hash, "data")
    await connectNodes(page, hash, "hash", out, "input")
    await executeAll(page)
    expect(await getOutput(page, out, "value")).toBe("2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824")
  })

  test("String('hello') + String('secret') → HMAC(SHA-256) → String", async ({ page }) => {
    const data = await addNode(page, "string", { value: "hello" })
    const key = await addNode(page, "string", { value: "secret" })
    const hmac = await addNode(page, "hmac", { algorithm: "sha256" })
    const out = await addNode(page, "string", { value: "" })
    await connectNodes(page, data, "value", hmac, "data")
    await connectNodes(page, key, "value", hmac, "key")
    await connectNodes(page, hmac, "hmac", out, "input")
    await executeAll(page)
    const result = await getOutput(page, out, "value")
    expect(typeof result).toBe("string")
    expect((result as string).length).toBe(64)
  })

  test("String('hello') → Encoding(Base64) → String", async ({ page }) => {
    const src = await addNode(page, "string", { value: "hello" })
    const enc = await addNode(page, "encoding", { encoding: "base64" })
    const out = await addNode(page, "string", { value: "" })
    await connectNodes(page, src, "value", enc, "input")
    await connectNodes(page, enc, "output", out, "input")
    await executeAll(page)
    expect(await getOutput(page, out, "value")).toBe("aGVsbG8=")
  })

  test("String('hello world') → Encoding(URL) → String", async ({ page }) => {
    const src = await addNode(page, "string", { value: "hello world" })
    const enc = await addNode(page, "encoding", { encoding: "url" })
    const out = await addNode(page, "string", { value: "" })
    await connectNodes(page, src, "value", enc, "input")
    await connectNodes(page, enc, "output", out, "input")
    await executeAll(page)
    expect(await getOutput(page, out, "value")).toBe("hello%20world")
  })

  test("String('hi') → Encoding(HEX) → String", async ({ page }) => {
    const src = await addNode(page, "string", { value: "hi" })
    const enc = await addNode(page, "encoding", { encoding: "hex" })
    const out = await addNode(page, "string", { value: "" })
    await connectNodes(page, src, "value", enc, "input")
    await connectNodes(page, enc, "output", out, "input")
    await executeAll(page)
    expect(await getOutput(page, out, "value")).toBe("6869")
  })

  test("String('aGVsbG8=') → Encoding(Base64-Decode) → String", async ({ page }) => {
    const src = await addNode(page, "string", { value: "aGVsbG8=" })
    const mode = await addNode(page, "string", { value: "decode" })
    const enc = await addNode(page, "encoding", { encoding: "base64" })
    const out = await addNode(page, "string", { value: "" })
    await connectNodes(page, src, "value", enc, "input")
    await connectNodes(page, mode, "value", enc, "mode")
    await connectNodes(page, enc, "output", out, "input")
    await executeAll(page)
    expect(await getOutput(page, out, "value")).toBe("hello")
  })

  test("String('hello') → Classic Cipher(ROT13) → String", async ({ page }) => {
    const src = await addNode(page, "string", { value: "hello" })
    const cipher = await addNode(page, "classic-cipher", { algorithm: "rot13" })
    const out = await addNode(page, "string", { value: "" })
    await connectNodes(page, src, "value", cipher, "data")
    await connectNodes(page, cipher, "result", out, "input")
    await executeAll(page)
    expect(await getOutput(page, out, "value")).toBe("uryyb")
  })

  test("String('abc') → Classic Cipher(Caesar, shift=3) → String", async ({ page }) => {
    const src = await addNode(page, "string", { value: "abc" })
    const cipher = await addNode(page, "classic-cipher", { algorithm: "caesar", shift: 3 })
    const out = await addNode(page, "string", { value: "" })
    await connectNodes(page, src, "value", cipher, "data")
    await connectNodes(page, cipher, "result", out, "input")
    await executeAll(page)
    expect(await getOutput(page, out, "value")).toBe("def")
  })

  test("String('hello world') → Case Converter → String(upper)", async ({ page }) => {
    const src = await addNode(page, "string", { value: "hello world" })
    const conv = await addNode(page, "case-converter")
    const out = await addNode(page, "string", { value: "" })
    await connectNodes(page, src, "value", conv, "text")
    await connectNodes(page, conv, "upper", out, "input")
    await executeAll(page)
    expect(await getOutput(page, out, "value")).toBe("HELLO WORLD")
  })

  test("String('255') → Base Converter(10→hex) → String", async ({ page }) => {
    const src = await addNode(page, "string", { value: "255" })
    const conv = await addNode(page, "base-converter", { fromBase: "10" })
    const out = await addNode(page, "string", { value: "" })
    await connectNodes(page, src, "value", conv, "value")
    await connectNodes(page, conv, "hex", out, "input")
    await executeAll(page)
    expect(await getOutput(page, out, "value")).toBe("FF")
  })

  test("String('5') → Base Converter(10→binary) → String", async ({ page }) => {
    const src = await addNode(page, "string", { value: "5" })
    const conv = await addNode(page, "base-converter", { fromBase: "10" })
    const out = await addNode(page, "string", { value: "" })
    await connectNodes(page, src, "value", conv, "value")
    await connectNodes(page, conv, "binary", out, "input")
    await executeAll(page)
    expect(await getOutput(page, out, "value")).toBe("101")
  })

  test("String('{\"a\":1}') → JSON Format(minified) → String", async ({ page }) => {
    const src = await addNode(page, "string", { value: '{"a": 1}' })
    const fmt = await addNode(page, "json-format")
    const out = await addNode(page, "string", { value: "" })
    await connectNodes(page, src, "value", fmt, "data")
    await connectNodes(page, fmt, "minified", out, "input")
    await executeAll(page)
    expect(await getOutput(page, out, "value")).toBe('{"a":1}')
  })

  test("Number(100) → Temperature(C→F) → Number", async ({ page }) => {
    const src = await addNode(page, "number", { value: 100 })
    const temp = await addNode(page, "temperature-converter", { fromUnit: "celsius" })
    const out = await addNode(page, "number", { value: 0 })
    await connectNodes(page, src, "value", temp, "value")
    await connectNodes(page, temp, "fahrenheit", out, "input")
    await executeAll(page)
    expect(await getOutput(page, out, "value")).toBe(212)
  })

  test("Number(0) → Temperature(C→K) → Number", async ({ page }) => {
    const src = await addNode(page, "number", { value: 0 })
    const temp = await addNode(page, "temperature-converter", { fromUnit: "celsius" })
    const out = await addNode(page, "number", { value: 0 })
    await connectNodes(page, src, "value", temp, "value")
    await connectNodes(page, temp, "kelvin", out, "input")
    await executeAll(page)
    expect(await getOutput(page, out, "value")).toBeCloseTo(273.15, 1)
  })

  test("Number(70) + Number(1.75) → BMI → Number", async ({ page }) => {
    const weight = await addNode(page, "number", { value: 70 })
    const height = await addNode(page, "number", { value: 1.75 })
    const bmi = await addNode(page, "bmi")
    const out = await addNode(page, "number", { value: 0 })
    await connectNodes(page, weight, "value", bmi, "weight")
    await connectNodes(page, height, "value", bmi, "height")
    await connectNodes(page, bmi, "bmi", out, "input")
    await executeAll(page)
    expect(await getOutput(page, out, "value")).toBeCloseTo(22.86, 1)
  })

  test("String('#ff0000') → Color → String(hex)", async ({ page }) => {
    const src = await addNode(page, "string", { value: "#ff0000" })
    const color = await addNode(page, "color")
    const out = await addNode(page, "string", { value: "" })
    await connectNodes(page, src, "value", color, "color")
    await connectNodes(page, color, "hex", out, "input")
    await executeAll(page)
    expect(await getOutput(page, out, "value")).toBe("#ff0000")
  })

  test("String(JWT) → JWT → JSON(header)", async ({ page }) => {
    const jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U"
    const src = await addNode(page, "string", { value: jwt })
    const jwtNode = await addNode(page, "jwt")
    const out = await addNode(page, "json", { value: "{}" })
    await connectNodes(page, src, "value", jwtNode, "token")
    await connectNodes(page, jwtNode, "header", out, "input")
    await executeAll(page)
    expect(await getOutput(page, out, "value")).toHaveProperty("alg", "HS256")
  })

  test("String('test123') → Regex(pattern=\\d+) → JSON(matches)", async ({ page }) => {
    const src = await addNode(page, "string", { value: "test123" })
    const regex = await addNode(page, "regex", { pattern: "\\d+", flags: "g" })
    const out = await addNode(page, "json", { value: "{}" })
    await connectNodes(page, src, "value", regex, "text")
    await connectNodes(page, regex, "matches", out, "input")
    await executeAll(page)
    const output = await getOutput(page, out, "value")
    expect(Array.isArray(output)).toBe(true)
    expect(output).toContain("123")
  })

  test("String('abc') + String('abd') → Diff → JSON", async ({ page }) => {
    const src1 = await addNode(page, "string", { value: "abc" })
    const src2 = await addNode(page, "string", { value: "abd" })
    const diff = await addNode(page, "diff")
    const out = await addNode(page, "json", { value: "{}" })
    await connectNodes(page, src1, "value", diff, "text1")
    await connectNodes(page, src2, "value", diff, "text2")
    await connectNodes(page, diff, "diff", out, "input")
    await executeAll(page)
    const output = await getOutput(page, out, "value")
    expect(output).toHaveProperty("changes")
    expect(output).toHaveProperty("added")
    expect(output).toHaveProperty("removed")
  })

  test("String('* * * * *') → Crontab → JSON(parsed)", async ({ page }) => {
    const src = await addNode(page, "string", { value: "* * * * *" })
    const cron = await addNode(page, "crontab")
    const out = await addNode(page, "json", { value: "{}" })
    await connectNodes(page, src, "value", cron, "expression")
    await connectNodes(page, cron, "parsed", out, "input")
    await executeAll(page)
    const output = await getOutput(page, out, "value")
    expect(output).toHaveProperty("minute")
    expect(output).toHaveProperty("hour")
  })

  test("String('hello world') → Text Stats → JSON", async ({ page }) => {
    const src = await addNode(page, "string", { value: "hello world" })
    const stats = await addNode(page, "text-stats")
    const out = await addNode(page, "json", { value: "{}" })
    await connectNodes(page, src, "value", stats, "text")
    await connectNodes(page, stats, "stats", out, "input")
    await executeAll(page)
    const output = await getOutput(page, out, "value")
    expect(output).toHaveProperty("characters", 11)
    expect(output).toHaveProperty("words", 2)
  })
})

test.describe("Pipeline: Source Nodes", () => {
  test.beforeEach(async ({ page }) => {
    nodeCounter = 0
    await page.goto("/canvas")
    await page.waitForLoadState("networkidle")
    await page.waitForSelector(".react-flow", { timeout: 15000 })
  })

  test("UUID(v4) → String: format matches", async ({ page }) => {
    const uuid = await addNode(page, "uuid", { version: "v4" })
    const out = await addNode(page, "string", { value: "" })
    await connectNodes(page, uuid, "uuid", out, "input")
    await executeAll(page)
    const output = await getOutput(page, out, "value")
    expect(typeof output).toBe("string")
    if ((output as string).length > 0) {
      expect(output).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    }
  })

  test("Time → Number(timestamp): exists and > 0", async ({ page }) => {
    const time = await addNode(page, "time")
    const out = await addNode(page, "number", { value: 0 })
    await connectNodes(page, time, "timestamp", out, "input")
    await executeAll(page)
    const output = await getOutput(page, out, "value")
    expect(typeof output).toBe("number")
    expect(output).toBeGreaterThan(0)
  })

  test("Time → String(iso): contains T", async ({ page }) => {
    const time = await addNode(page, "time")
    const out = await addNode(page, "string", { value: "" })
    await connectNodes(page, time, "iso", out, "input")
    await executeAll(page)
    const output = await getOutput(page, out, "value")
    expect(typeof output).toBe("string")
    expect(output).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  test("Device Info → JSON: is object", async ({ page }) => {
    const device = await addNode(page, "device-info")
    const out = await addNode(page, "json", { value: "{}" })
    await connectNodes(page, device, "info", out, "input")
    await executeAll(page)
    const output = await getOutput(page, out, "value")
    expect(typeof output).toBe("object")
  })
})

test.describe("Node Parameter Rendering", () => {
  test.beforeEach(async ({ page }) => {
    nodeCounter = 0
    await page.goto("/canvas")
    await page.waitForLoadState("networkidle")
    await page.waitForSelector(".react-flow", { timeout: 15000 })
  })

  test("Hash: algorithm dropdown visible", async ({ page }) => {
    await addNode(page, "hash")
    await page.waitForTimeout(500)
    const node = page.locator(".react-flow__node").first()
    await expect(node.locator("[data-testid='select-input']").first()).toBeVisible({ timeout: 5000 })
  })

  test("Classic Cipher: caesar shows shift, vigenere shows key", async ({ page }) => {
    await addNode(page, "classic-cipher", { algorithm: "caesar" })
    await page.waitForTimeout(500)
    const node = page.locator(".react-flow__node").first()
    
    // Caesar shows algorithm select and shift number input
    await expect(node.locator("[data-testid='select-input']").first()).toBeVisible({ timeout: 5000 })
    await expect(node.locator("[data-testid='number-input']")).toBeVisible({ timeout: 5000 })
    
    // Change to vigenere
    await node.locator("[data-testid='select-input']").first().selectOption("vigenere")
    await page.waitForTimeout(500)
    
    // Vigenere shows key text input
    await expect(node.locator("[data-testid='text-input']").first()).toBeVisible({ timeout: 5000 })
  })

  test("QRCode: size slider + color pickers", async ({ page }) => {
    await addNode(page, "qrcode")
    await page.waitForTimeout(500)
    const node = page.locator(".react-flow__node").first()
    await expect(node).toBeVisible()
    await expect(node.locator("[data-testid='slider-input']")).toBeVisible({ timeout: 5000 })
    await expect(node.locator("[data-testid='color-input']")).toHaveCount(2, { timeout: 5000 })
  })

  test("Image Compress: quality slider", async ({ page }) => {
    await addNode(page, "image-compress")
    await page.waitForTimeout(500)
    const node = page.locator(".react-flow__node").first()
    await expect(node).toBeVisible()
    await expect(node.locator("[data-testid='slider-input']")).toBeVisible({ timeout: 5000 })
  })

  test("Image Editor: brightness/contrast/saturation sliders + grayscale switch", async ({ page }) => {
    await addNode(page, "image-editor")
    await page.waitForTimeout(500)
    const node = page.locator(".react-flow__node").first()
    await expect(node).toBeVisible()
    await expect(node.locator("[data-testid='slider-input']")).toHaveCount(3, { timeout: 5000 })
    await expect(node.locator("[data-testid='switch-input']")).toBeVisible({ timeout: 5000 })
  })

  test("JSON Format: indent slider + sortKeys switch", async ({ page }) => {
    await addNode(page, "json-format")
    await page.waitForTimeout(500)
    const node = page.locator(".react-flow__node").first()
    await expect(node).toBeVisible()
    await expect(node.locator("[data-testid='slider-input']")).toBeVisible({ timeout: 5000 })
    await expect(node.locator("[data-testid='switch-input']")).toBeVisible({ timeout: 5000 })
  })

  test("UUID: version dropdown + uppercase/hyphens switches", async ({ page }) => {
    await addNode(page, "uuid")
    await page.waitForTimeout(500)
    const node = page.locator(".react-flow__node").first()
    await expect(node).toBeVisible()
    await expect(node.locator("[data-testid='select-input']")).toBeVisible({ timeout: 5000 })
    await expect(node.locator("[data-testid='switch-input']")).toHaveCount(2, { timeout: 5000 })
  })

  test("Meme Splitter: rows/cols sliders", async ({ page }) => {
    await addNode(page, "meme-splitter")
    await page.waitForTimeout(500)
    const node = page.locator(".react-flow__node").first()
    await expect(node).toBeVisible()
    await expect(node.locator("[data-testid='slider-input']")).toHaveCount(2, { timeout: 5000 })
  })

  test("Temperature: fromUnit dropdown", async ({ page }) => {
    await addNode(page, "temperature-converter")
    await page.waitForTimeout(500)
    const node = page.locator(".react-flow__node").first()
    await expect(node).toBeVisible()
    await expect(node.locator("[data-testid='select-input']")).toBeVisible({ timeout: 5000 })
  })

  test("Encoding: encoding dropdown", async ({ page }) => {
    await addNode(page, "encoding")
    await page.waitForTimeout(500)
    const node = page.locator(".react-flow__node").first()
    await expect(node).toBeVisible()
    await expect(node.locator("[data-testid='select-input']")).toBeVisible({ timeout: 5000 })
  })

  test("HMAC: algorithm dropdown", async ({ page }) => {
    await addNode(page, "hmac")
    await page.waitForTimeout(500)
    const node = page.locator(".react-flow__node").first()
    await expect(node.locator("[data-testid='select-input']").first()).toBeVisible({ timeout: 5000 })
  })

  test("Regex: pattern/flags inputs + replacement textarea", async ({ page }) => {
    await addNode(page, "regex")
    await page.waitForTimeout(500)
    const node = page.locator(".react-flow__node").first()
    await expect(node).toBeVisible()
    await expect(node.locator("[data-testid='text-input']")).toHaveCount(2, { timeout: 5000 })
    await expect(node.locator("[data-testid='textarea-input']")).toBeVisible({ timeout: 5000 })
  })

  test("Time: timezone dropdown", async ({ page }) => {
    await addNode(page, "time")
    await page.waitForTimeout(500)
    const node = page.locator(".react-flow__node").first()
    await expect(node).toBeVisible()
    await expect(node.locator("[data-testid='select-input']")).toBeVisible({ timeout: 5000 })
  })

  test("Protobuf: mode dropdown", async ({ page }) => {
    await addNode(page, "protobuf")
    await page.waitForTimeout(500)
    const node = page.locator(".react-flow__node").first()
    await expect(node).toBeVisible()
    await expect(node.locator("[data-testid='select-input']")).toBeVisible({ timeout: 5000 })
  })
})
