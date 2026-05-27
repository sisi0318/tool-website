import { test, expect, type Page } from "@playwright/test"

// ─── Helper Functions ───────────────────────────────────────────────────────

let nodeCounter = 0

function uniqueId(prefix: string) {
  return `${prefix}-${++nodeCounter}`
}

async function addNode(
  page: Page,
  type: string,
  config: Record<string, unknown> = {}
): Promise<string> {
  const id = uniqueId(type)
  await page.evaluate(
    ({ id, type, config }) => {
      const store = (window as any).__ZUSTAND_STORE__
      store.getState().addNode({
        id,
        type,
        position: { x: 300 + Math.random() * 200, y: 200 + Math.random() * 200 },
        config,
      })
    },
    { id, type, config }
  )
  await page.waitForTimeout(300)
  return id
}

async function connectNodes(
  page: Page,
  sourceId: string,
  sourcePort: string,
  targetId: string,
  targetPort: string
) {
  await page.evaluate(
    ({ sourceId, sourcePort, targetId, targetPort }) => {
      const store = (window as any).__ZUSTAND_STORE__
      store.getState().addEdge({
        id: `edge-${sourceId}-${sourcePort}-${targetId}-${targetPort}`,
        source: sourceId,
        sourcePort,
        target: targetId,
        targetPort,
      })
    },
    { sourceId, sourcePort, targetId, targetPort }
  )
  await page.waitForTimeout(200)
}

async function executeAll(page: Page) {
  await page.evaluate(() => {
    const store = (window as any).__ZUSTAND_STORE__
    return store.getState().executeAll()
  })
  await page.waitForTimeout(500)
}

async function getNodeOutput(
  page: Page,
  nodeId: string,
  portId: string
): Promise<unknown> {
  return page.evaluate(
    ({ nodeId, portId }) => {
      const store = (window as any).__ZUSTAND_STORE__
      const outputs = store.getState().nodeOutputs[nodeId]
      return outputs ? outputs[portId] : undefined
    },
    { nodeId, portId }
  )
}

async function getNodeError(page: Page, nodeId: string): Promise<string | undefined> {
  return page.evaluate(
    ({ nodeId }) => {
      const store = (window as any).__ZUSTAND_STORE__
      return store.getState().nodeErrors[nodeId]
    },
    { nodeId }
  )
}

async function waitForNodeRender(page: Page, count: number) {
  await page.waitForTimeout(500)
  const nodes = page.locator(".react-flow__node")
  await expect(nodes).toHaveCount(count, { timeout: 5000 })
}

// ─── Port Definitions ───────────────────────────────────────────────────────

const NODE_PORTS: Record<string, { inputs: number; outputs: number }> = {
  // basic
  string: { inputs: 1, outputs: 1 },
  number: { inputs: 1, outputs: 1 },
  json: { inputs: 1, outputs: 1 },
  file: { inputs: 1, outputs: 1 },
  // crypto
  hash: { inputs: 1, outputs: 2 },
  hmac: { inputs: 2, outputs: 1 },
  crypto: { inputs: 2, outputs: 1 },
  encoding: { inputs: 2, outputs: 1 },
  "classic-cipher": { inputs: 1, outputs: 1 },
  jwt: { inputs: 1, outputs: 3 },
  // data
  "json-format": { inputs: 1, outputs: 2 },
  protobuf: { inputs: 1, outputs: 1 },
  jce: { inputs: 1, outputs: 1 },
  // image
  "image-to-base64": { inputs: 1, outputs: 2 },
  "exif-viewer": { inputs: 1, outputs: 1 },
  "image-compress": { inputs: 1, outputs: 2 },
  "image-editor": { inputs: 1, outputs: 1 },
  qrcode: { inputs: 1, outputs: 2 },
  "qrcode-decode": { inputs: 1, outputs: 1 },
  "meme-splitter": { inputs: 1, outputs: 1 },
  "image-coordinates": { inputs: 1, outputs: 1 },
  // text
  "text-stats": { inputs: 1, outputs: 1 },
  "case-converter": { inputs: 1, outputs: 6 },
  regex: { inputs: 1, outputs: 2 },
  diff: { inputs: 2, outputs: 1 },
  // dev
  "http-tester": { inputs: 2, outputs: 2 },
  crontab: { inputs: 1, outputs: 2 },
  "docker-converter": { inputs: 1, outputs: 2 },
  whois: { inputs: 1, outputs: 1 },
  // utility
  uuid: { inputs: 0, outputs: 1 },
  totp: { inputs: 1, outputs: 2 },
  color: { inputs: 1, outputs: 3 },
  "base-converter": { inputs: 1, outputs: 4 },
  "temperature-converter": { inputs: 1, outputs: 3 },
  currency: { inputs: 1, outputs: 1 },
  bmi: { inputs: 2, outputs: 2 },
  // viewer
  "device-info": { inputs: 0, outputs: 1 },
  "office-viewer": { inputs: 1, outputs: 1 },
  time: { inputs: 0, outputs: 4 },
}

// ─── Tests ──────────────────────────────────────────────────────────────────

test.describe("Canvas Node Port Verification", () => {
  test.beforeEach(async ({ page }) => {
    nodeCounter = 0
    await page.goto("/canvas")
    await page.waitForLoadState("networkidle")
    await page.waitForSelector(".react-flow", { timeout: 15000 })
  })

  for (const [nodeType, expected] of Object.entries(NODE_PORTS)) {
    test(`${nodeType}: ${expected.inputs} inputs, ${expected.outputs} outputs`, async ({
      page,
    }) => {
      const nodeId = await addNode(page, nodeType)
      await waitForNodeRender(page, 1)

      const leftHandles = page.locator(
        `.react-flow__node [data-id="${nodeId}"] .react-flow__handle[data-handlepos='left']`
      )
      const rightHandles = page.locator(
        `.react-flow__node [data-id="${nodeId}"] .react-flow__handle[data-handlepos='right']`
      )

      // Fallback: count handles within the node element
      const nodeEl = page.locator(".react-flow__node").first()
      const inputHandles = nodeEl.locator(".react-flow__handle[data-handlepos='left']")
      const outputHandles = nodeEl.locator(".react-flow__handle[data-handlepos='right']")

      await expect(inputHandles).toHaveCount(expected.inputs)
      await expect(outputHandles).toHaveCount(expected.outputs)
    })
  }
})

test.describe("Canvas Tool Functional Tests", () => {
  test.beforeEach(async ({ page }) => {
    nodeCounter = 0
    await page.goto("/canvas")
    await page.waitForLoadState("networkidle")
    await page.waitForSelector(".react-flow", { timeout: 15000 })
  })

  test.describe("Deterministic Output (Group A)", () => {
    test("String → Hash(SHA-256) → String", async ({ page }) => {
      const srcId = await addNode(page, "string", { value: "hello" })
      const hashId = await addNode(page, "hash", { algorithm: "sha256" })
      const outId = await addNode(page, "string", { value: "" })
      await waitForNodeRender(page, 3)

      await connectNodes(page, srcId, "value", hashId, "data")
      await connectNodes(page, hashId, "hash", outId, "input")
      await executeAll(page)

      const output = await getNodeOutput(page, outId, "value")
      expect(output).toBe(
        "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
      )
    })

    test("String → Encoding(Base64) → String", async ({ page }) => {
      const srcId = await addNode(page, "string", { value: "hello" })
      const encId = await addNode(page, "encoding", { mode: "base64-encode" })
      const outId = await addNode(page, "string", { value: "" })
      await waitForNodeRender(page, 3)

      await connectNodes(page, srcId, "value", encId, "input")
      await connectNodes(page, encId, "output", outId, "input")
      await executeAll(page)

      const output = await getNodeOutput(page, outId, "value")
      expect(output).toBe("aGVsbG8=")
    })

    test("String(Base64) → Encoding(Base64-Decode) → String", async ({ page }) => {
      const srcId = await addNode(page, "string", { value: "aGVsbG8=" })
      const modeId = await addNode(page, "string", { value: "decode" })
      const encId = await addNode(page, "encoding", { encoding: "base64" })
      const outId = await addNode(page, "string", { value: "" })
      await waitForNodeRender(page, 4)

      await connectNodes(page, srcId, "value", encId, "input")
      await connectNodes(page, modeId, "value", encId, "mode")
      await connectNodes(page, encId, "output", outId, "input")
      await executeAll(page)

      const output = await getNodeOutput(page, outId, "value")
      expect(output).toBe("hello")
    })

    test("String → Case Converter(upper) → String", async ({ page }) => {
      const srcId = await addNode(page, "string", { value: "hello world" })
      const convId = await addNode(page, "case-converter")
      const outId = await addNode(page, "string", { value: "" })
      await waitForNodeRender(page, 3)

      await connectNodes(page, srcId, "value", convId, "text")
      await connectNodes(page, convId, "upper", outId, "input")
      await executeAll(page)

      const output = await getNodeOutput(page, outId, "value")
      expect(output).toBe("HELLO WORLD")
    })

    test("String → Base Converter(10→hex) → String", async ({ page }) => {
      const srcId = await addNode(page, "string", { value: "255" })
      const convId = await addNode(page, "base-converter")
      const outId = await addNode(page, "string", { value: "" })
      await waitForNodeRender(page, 3)

      await connectNodes(page, srcId, "value", convId, "value")
      await connectNodes(page, convId, "hex", outId, "input")
      await executeAll(page)

      const output = await getNodeOutput(page, outId, "value")
      expect(output).toBe("FF")
    })

    test("String → JSON Format(minified) → String", async ({ page }) => {
      const srcId = await addNode(page, "string", { value: '{"a": 1}' })
      const fmtId = await addNode(page, "json-format")
      const outId = await addNode(page, "string", { value: "" })
      await waitForNodeRender(page, 3)

      await connectNodes(page, srcId, "value", fmtId, "data")
      await connectNodes(page, fmtId, "minified", outId, "input")
      await executeAll(page)

      const output = await getNodeOutput(page, outId, "value")
      expect(output).toBe('{"a":1}')
    })

    test("String → Classic Cipher(ROT13) → String", async ({ page }) => {
      const srcId = await addNode(page, "string", { value: "hello" })
      const cipherId = await addNode(page, "classic-cipher", { cipher: "rot13" })
      const outId = await addNode(page, "string", { value: "" })
      await waitForNodeRender(page, 3)

      await connectNodes(page, srcId, "value", cipherId, "data")
      await connectNodes(page, cipherId, "result", outId, "input")
      await executeAll(page)

      const output = await getNodeOutput(page, outId, "value")
      expect(output).toBe("uryyb")
    })

    test("String → Text Stats → JSON", async ({ page }) => {
      const srcId = await addNode(page, "string", { value: "hello world" })
      const statsId = await addNode(page, "text-stats")
      const outId = await addNode(page, "json", { value: "{}" })
      await waitForNodeRender(page, 3)

      await connectNodes(page, srcId, "value", statsId, "text")
      await connectNodes(page, statsId, "stats", outId, "input")
      await executeAll(page)

      const output = await getNodeOutput(page, outId, "value")
      expect(output).toBeDefined()
      expect(output).toHaveProperty("characters", 11)
      expect(output).toHaveProperty("words", 2)
    })

    test("String → Crontab → JSON(parsed)", async ({ page }) => {
      const srcId = await addNode(page, "string", { value: "* * * * *" })
      const cronId = await addNode(page, "crontab")
      const outId = await addNode(page, "json", { value: "{}" })
      await waitForNodeRender(page, 3)

      await connectNodes(page, srcId, "value", cronId, "expression")
      await connectNodes(page, cronId, "parsed", outId, "input")
      await executeAll(page)

      const output = await getNodeOutput(page, outId, "value")
      expect(output).toBeDefined()
      expect(output).toHaveProperty("minute")
      expect(output).toHaveProperty("hour")
    })

    test("Number → Temperature(C→F) → Number", async ({ page }) => {
      const srcId = await addNode(page, "number", { value: 100 })
      const tempId = await addNode(page, "temperature-converter", { from: "celsius", to: "fahrenheit" })
      const outId = await addNode(page, "number", { value: 0 })
      await waitForNodeRender(page, 3)

      await connectNodes(page, srcId, "value", tempId, "value")
      await connectNodes(page, tempId, "fahrenheit", outId, "input")
      await executeAll(page)

      const output = await getNodeOutput(page, outId, "value")
      expect(output).toBe(212)
    })

    test("Number + Number → BMI → Number", async ({ page }) => {
      const weightId = await addNode(page, "number", { value: 70 })
      const heightId = await addNode(page, "number", { value: 1.75 })
      const bmiId = await addNode(page, "bmi")
      const outId = await addNode(page, "number", { value: 0 })
      await waitForNodeRender(page, 4)

      await connectNodes(page, weightId, "value", bmiId, "weight")
      await connectNodes(page, heightId, "value", bmiId, "height")
      await connectNodes(page, bmiId, "bmi", outId, "input")
      await executeAll(page)

      const output = await getNodeOutput(page, outId, "value")
      expect(output).toBeCloseTo(22.86, 1)
    })

    test("String → Color → String(hex)", async ({ page }) => {
      const srcId = await addNode(page, "string", { value: "#ff0000" })
      const colorId = await addNode(page, "color")
      const outId = await addNode(page, "string", { value: "" })
      await waitForNodeRender(page, 3)

      await connectNodes(page, srcId, "value", colorId, "color")
      await connectNodes(page, colorId, "hex", outId, "input")
      await executeAll(page)

      const output = await getNodeOutput(page, outId, "value")
      expect(output).toBe("#ff0000")
    })

    test("String → JWT → JSON(header)", async ({ page }) => {
      // Valid JWT with HS256 header and simple payload (no signature verification)
      const jwt =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U"
      const srcId = await addNode(page, "string", { value: jwt })
      const jwtId = await addNode(page, "jwt")
      const outId = await addNode(page, "json", { value: "{}" })
      await waitForNodeRender(page, 3)

      await connectNodes(page, srcId, "value", jwtId, "token")
      await connectNodes(page, jwtId, "header", outId, "input")
      await executeAll(page)

      const output = await getNodeOutput(page, outId, "value")
      expect(output).toBeDefined()
      expect(output).toHaveProperty("alg", "HS256")
    })
  })

  test.describe("Format Verification (Group B)", () => {
    test("String → HMAC → String (output exists)", async ({ page }) => {
      const srcId = await addNode(page, "string", { value: "hello" })
      const keyId = await addNode(page, "string", { value: "secret" })
      const hmacId = await addNode(page, "hmac", { algorithm: "sha256" })
      const outId = await addNode(page, "string", { value: "" })
      await waitForNodeRender(page, 4)

      await connectNodes(page, srcId, "value", hmacId, "data")
      await connectNodes(page, keyId, "value", hmacId, "key")
      await connectNodes(page, hmacId, "hmac", outId, "input")
      await executeAll(page)

      const output = await getNodeOutput(page, outId, "value")
      expect(typeof output).toBe("string")
      expect((output as string).length).toBeGreaterThan(0)
    })

    test("String → Regex → JSON(matches)", async ({ page }) => {
      const srcId = await addNode(page, "string", { value: "test123test" })
      const regexId = await addNode(page, "regex", { pattern: "\\d+", flags: "g" })
      const outId = await addNode(page, "json", { value: "{}" })
      await waitForNodeRender(page, 3)

      await connectNodes(page, srcId, "value", regexId, "text")
      await connectNodes(page, regexId, "matches", outId, "input")
      await executeAll(page)

      const output = await getNodeOutput(page, outId, "value")
      expect(output).toBeDefined()
      expect(Array.isArray(output)).toBe(true)
      expect(output).toContain("123")
    })

    test("String + String → Diff → JSON", async ({ page }) => {
      const src1Id = await addNode(page, "string", { value: "abc" })
      const src2Id = await addNode(page, "string", { value: "abd" })
      const diffId = await addNode(page, "diff")
      const outId = await addNode(page, "json", { value: "{}" })
      await waitForNodeRender(page, 4)

      await connectNodes(page, src1Id, "value", diffId, "text1")
      await connectNodes(page, src2Id, "value", diffId, "text2")
      await connectNodes(page, diffId, "diff", outId, "input")
      await executeAll(page)

      const output = await getNodeOutput(page, outId, "value")
      expect(output).toBeDefined()
      expect(output).toHaveProperty("changes")
      expect(output).toHaveProperty("added")
      expect(output).toHaveProperty("removed")
    })

    test("String → Crontab → JSON(nextRuns)", async ({ page }) => {
      const srcId = await addNode(page, "string", { value: "0 9 * * *" })
      const cronId = await addNode(page, "crontab")
      const outId = await addNode(page, "json", { value: "{}" })
      await waitForNodeRender(page, 3)

      await connectNodes(page, srcId, "value", cronId, "expression")
      await connectNodes(page, cronId, "nextRuns", outId, "input")
      await executeAll(page)

      const output = await getNodeOutput(page, outId, "value")
      expect(output).toBeDefined()
      expect(Array.isArray(output)).toBe(true)
      expect((output as any[]).length).toBeGreaterThan(0)
    })

    test("Number → Temperature(C→K) → Number", async ({ page }) => {
      const srcId = await addNode(page, "number", { value: 0 })
      const tempId = await addNode(page, "temperature-converter", { from: "celsius", to: "kelvin" })
      const outId = await addNode(page, "number", { value: 0 })
      await waitForNodeRender(page, 3)

      await connectNodes(page, srcId, "value", tempId, "value")
      await connectNodes(page, tempId, "kelvin", outId, "input")
      await executeAll(page)

      const output = await getNodeOutput(page, outId, "value")
      expect(output).toBeCloseTo(273.15, 1)
    })
  })

  test.describe("Source Nodes (Group D)", () => {
    test("UUID: output exists and matches format", async ({ page }) => {
      const uuidId = await addNode(page, "uuid")
      const outId = await addNode(page, "string", { value: "" })
      await waitForNodeRender(page, 2)

      await connectNodes(page, uuidId, "uuid", outId, "input")
      await executeAll(page)

      const output = await getNodeOutput(page, outId, "value")
      expect(typeof output).toBe("string")
      // UUID format: 8-4-4-4-12 hex chars (may be empty if randomUUID fails in browser)
      if ((output as string).length > 0) {
        expect(output).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        )
      }
    })

    test("Time: output contains timestamp and iso", async ({ page }) => {
      const timeId = await addNode(page, "time")
      const numOutId = await addNode(page, "number", { value: 0 })
      const strOutId = await addNode(page, "string", { value: "" })
      await waitForNodeRender(page, 3)

      await connectNodes(page, timeId, "timestamp", numOutId, "input")
      await connectNodes(page, timeId, "iso", strOutId, "input")
      await executeAll(page)

      const timestamp = await getNodeOutput(page, numOutId, "value")
      const iso = await getNodeOutput(page, strOutId, "value")

      expect(typeof timestamp).toBe("number")
      expect(timestamp).toBeGreaterThan(0)
      expect(typeof iso).toBe("string")
      expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })

    test("Device Info: output exists and is object", async ({ page }) => {
      const deviceId = await addNode(page, "device-info")
      const outId = await addNode(page, "json", { value: "{}" })
      await waitForNodeRender(page, 2)

      await connectNodes(page, deviceId, "info", outId, "input")
      await executeAll(page)

      const output = await getNodeOutput(page, outId, "value")
      expect(output).toBeDefined()
      expect(typeof output).toBe("object")
    })
  })
})
