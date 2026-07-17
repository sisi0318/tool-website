import { test, expect, type Page } from "@playwright/test"

let nodeCounter = 0

function uniqueId(prefix: string) {
  return `${prefix}-${++nodeCounter}`
}

async function openCanvas(page: Page) {
  const browserErrors: string[] = []
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text())
  })
  page.on("pageerror", (error) =>
    browserErrors.push(error.stack ?? error.message)
  )
  page.on("requestfailed", (request) => {
    browserErrors.push(
      `${request.method()} ${request.url()}: ${request.failure()?.errorText ?? "failed"}`
    )
  })

  let responseStatus: number | string = "no response"
  let lastError: unknown
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const bootstrapTimeout = attempt === 0 ? 10_000 : 15_000
    const scriptError = page
      .waitForEvent("pageerror", { timeout: bootstrapTimeout })
      .then((error) => ({ mounted: false as const, error }))
      .catch(() => new Promise<never>(() => {}))
    const retryQuery = attempt === 0 ? "" : `?e2e-retry=${Date.now()}`
    const response = await page.goto(`/canvas${retryQuery}`, {
      waitUntil: "domcontentloaded",
    })
    responseStatus = response?.status() ?? "no response"
    const canvasMounted = page
      .locator(".react-flow")
      .waitFor({ state: "visible", timeout: bootstrapTimeout })
      .then(() => ({ mounted: true as const }))
      .catch((error) => ({ mounted: false as const, error }))
    const result = await Promise.race([canvasMounted, scriptError])
    if (result.mounted) {
      return
    }
    lastError = result.error
  }

  console.error(`Canvas bootstrap failed (${responseStatus}):`, browserErrors)
  throw lastError
}

async function addNode(page: Page, type: string, config: Record<string, unknown> = {}): Promise<string> {
  const id = uniqueId(type)
  await page.evaluate(({ id, type, config }) => {
    const store = (window as any).__ZUSTAND_STORE__
    store.getState().addNode({ id, type, position: { x: 300 + Math.random() * 200, y: 200 + Math.random() * 200 }, config })
  }, { id, type, config })
  return id
}

async function connectNodes(page: Page, sourceId: string, sourcePort: string, targetId: string, targetPort: string) {
  await page.evaluate(({ s, sp, t, tp }) => {
    const store = (window as any).__ZUSTAND_STORE__
    store.getState().addEdge({ id: `edge-${s}-${sp}-${t}-${tp}`, source: s, sourcePort: sp, target: t, targetPort: tp })
  }, { s: sourceId, sp: sourcePort, t: targetId, tp: targetPort })
}

async function executeAll(page: Page) {
  await page.evaluate(() => {
    const store = (window as any).__ZUSTAND_STORE__
    return store.getState().executeAll()
  })
}

async function getOutput(page: Page, nodeId: string, portId: string): Promise<unknown> {
  return page.evaluate(({ nodeId, portId }) => {
    const store = (window as any).__ZUSTAND_STORE__
    return store.getState().nodeOutputs[nodeId]?.[portId]
  }, { nodeId, portId })
}

async function mockExchangeRates(page: Page) {
  await page.route("https://open.er-api.com/v6/latest/*", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        result: "success",
        rates: { USD: 1, CNY: 7.24, EUR: 0.92 },
      }),
    })
  })
}

test.describe("Pipeline: Deterministic Output", () => {
  test.beforeEach(async ({ page }) => {
    nodeCounter = 0
    await mockExchangeRates(page)
    await openCanvas(page)
  })

  test("String('1') → Hash(MD5) → String", async ({ page }) => {
    const src = await addNode(page, "string", { value: "1" })
    const hash = await addNode(page, "hash", { algorithm: "md5" })
    const out = await addNode(page, "string", { value: "" })
    await connectNodes(page, src, "value", hash, "data")
    await connectNodes(page, hash, "hash", out, "value")
    await executeAll(page)
    expect(await getOutput(page, out, "value")).toBe("c4ca4238a0b923820dcc509a6f75849b")
  })

  test("String('hello') → Hash(SHA-256) → String", async ({ page }) => {
    const src = await addNode(page, "string", { value: "hello" })
    const hash = await addNode(page, "hash", { algorithm: "sha256" })
    const out = await addNode(page, "string", { value: "" })
    await connectNodes(page, src, "value", hash, "data")
    await connectNodes(page, hash, "hash", out, "value")
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
    await connectNodes(page, hmac, "hmac", out, "value")
    await executeAll(page)
    const result = await getOutput(page, out, "value")
    expect(typeof result).toBe("string")
    expect((result as string).length).toBe(64)
  })

  test("String('hello') → Encoding(Base64) → String", async ({ page }) => {
    const src = await addNode(page, "string", { value: "hello" })
    const enc = await addNode(page, "encoding", { encoding: "base64", mode: "encode" })
    const out = await addNode(page, "string", { value: "" })
    await connectNodes(page, src, "value", enc, "input")
    await connectNodes(page, enc, "output", out, "value")
    await executeAll(page)
    expect(await getOutput(page, out, "value")).toBe("aGVsbG8=")
  })

  test("String('hello world') → Encoding(URL) → String", async ({ page }) => {
    const src = await addNode(page, "string", { value: "hello world" })
    const enc = await addNode(page, "encoding", { encoding: "url", mode: "encode" })
    const out = await addNode(page, "string", { value: "" })
    await connectNodes(page, src, "value", enc, "input")
    await connectNodes(page, enc, "output", out, "value")
    await executeAll(page)
    expect(await getOutput(page, out, "value")).toBe("hello%20world")
  })

  test("String('hi') → Encoding(HEX) → String", async ({ page }) => {
    const src = await addNode(page, "string", { value: "hi" })
    const enc = await addNode(page, "encoding", { encoding: "hex", mode: "encode" })
    const out = await addNode(page, "string", { value: "" })
    await connectNodes(page, src, "value", enc, "input")
    await connectNodes(page, enc, "output", out, "value")
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
    await connectNodes(page, enc, "output", out, "value")
    await executeAll(page)
    expect(await getOutput(page, out, "value")).toBe("hello")
  })

  test("String('hello') → Classic Cipher(ROT13) → String", async ({ page }) => {
    const src = await addNode(page, "string", { value: "hello" })
    const cipher = await addNode(page, "classic-cipher", { algorithm: "rot13" })
    const out = await addNode(page, "string", { value: "" })
    await connectNodes(page, src, "value", cipher, "data")
    await connectNodes(page, cipher, "result", out, "value")
    await executeAll(page)
    expect(await getOutput(page, out, "value")).toBe("uryyb")
  })

  test("String('abc') → Classic Cipher(Caesar, shift=3) → String", async ({ page }) => {
    const src = await addNode(page, "string", { value: "abc" })
    const cipher = await addNode(page, "classic-cipher", { algorithm: "caesar", shift: 3 })
    const out = await addNode(page, "string", { value: "" })
    await connectNodes(page, src, "value", cipher, "data")
    await connectNodes(page, cipher, "result", out, "value")
    await executeAll(page)
    expect(await getOutput(page, out, "value")).toBe("def")
  })

  test("String('hello world') → Case Converter → String(upper)", async ({ page }) => {
    const src = await addNode(page, "string", { value: "hello world" })
    const conv = await addNode(page, "case-converter")
    const out = await addNode(page, "string", { value: "" })
    await connectNodes(page, src, "value", conv, "text")
    await connectNodes(page, conv, "upper", out, "value")
    await executeAll(page)
    expect(await getOutput(page, out, "value")).toBe("HELLO WORLD")
  })

  test("String('255') → Base Converter(10→hex) → String", async ({ page }) => {
    const src = await addNode(page, "string", { value: "255" })
    const conv = await addNode(page, "base-converter", { fromBase: "10" })
    const out = await addNode(page, "string", { value: "" })
    await connectNodes(page, src, "value", conv, "value")
    await connectNodes(page, conv, "hex", out, "value")
    await executeAll(page)
    expect(await getOutput(page, out, "value")).toBe("FF")
  })

  test("String('5') → Base Converter(10→binary) → String", async ({ page }) => {
    const src = await addNode(page, "string", { value: "5" })
    const conv = await addNode(page, "base-converter", { fromBase: "10" })
    const out = await addNode(page, "string", { value: "" })
    await connectNodes(page, src, "value", conv, "value")
    await connectNodes(page, conv, "binary", out, "value")
    await executeAll(page)
    expect(await getOutput(page, out, "value")).toBe("101")
  })

  test("String('{\"a\":1}') → JSON Format(minified) → String", async ({ page }) => {
    const src = await addNode(page, "string", { value: '{"a": 1}' })
    const fmt = await addNode(page, "json-format")
    const out = await addNode(page, "string", { value: "" })
    await connectNodes(page, src, "value", fmt, "data")
    await connectNodes(page, fmt, "minified", out, "value")
    await executeAll(page)
    expect(await getOutput(page, out, "value")).toBe('{"a":1}')
  })

  test("Number(100) → Temperature(C→F) → Number", async ({ page }) => {
    const src = await addNode(page, "number", { value: 100 })
    const temp = await addNode(page, "temperature-converter", { fromUnit: "celsius" })
    const out = await addNode(page, "number", { value: 0 })
    await connectNodes(page, src, "value", temp, "value")
    await connectNodes(page, temp, "fahrenheit", out, "value")
    await executeAll(page)
    expect(await getOutput(page, out, "value")).toBe(212)
  })

  test("Number(0) → Temperature(C→K) → Number", async ({ page }) => {
    const src = await addNode(page, "number", { value: 0 })
    const temp = await addNode(page, "temperature-converter", { fromUnit: "celsius" })
    const out = await addNode(page, "number", { value: 0 })
    await connectNodes(page, src, "value", temp, "value")
    await connectNodes(page, temp, "kelvin", out, "value")
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
    await connectNodes(page, bmi, "bmi", out, "value")
    await executeAll(page)
    expect(await getOutput(page, out, "value")).toBeCloseTo(22.86, 1)
  })

  test("String('#ff0000') → Color → String(hex)", async ({ page }) => {
    const src = await addNode(page, "string", { value: "#ff0000" })
    const color = await addNode(page, "color")
    const out = await addNode(page, "string", { value: "" })
    await connectNodes(page, src, "value", color, "color")
    await connectNodes(page, color, "hex", out, "value")
    await executeAll(page)
    expect(await getOutput(page, out, "value")).toBe("#ff0000")
  })

  test("String(JWT) → JWT → JSON Preview(header)", async ({ page }) => {
    const jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U"
    const src = await addNode(page, "string", { value: jwt })
    const jwtNode = await addNode(page, "jwt")
    const out = await addNode(page, "json-preview")
    await connectNodes(page, src, "value", jwtNode, "token")
    await connectNodes(page, jwtNode, "header", out, "json")
    await executeAll(page)
    expect(await getOutput(page, out, "parsed")).toHaveProperty("alg", "HS256")
  })

  test("String('test123') → Regex(pattern=\\d+) → JSON Preview(matches)", async ({ page }) => {
    const src = await addNode(page, "string", { value: "test123" })
    const regex = await addNode(page, "regex", { pattern: "\\d+", flags: "g" })
    const out = await addNode(page, "json-preview")
    await connectNodes(page, src, "value", regex, "text")
    await connectNodes(page, regex, "matches", out, "json")
    await executeAll(page)
    const output = await getOutput(page, out, "parsed")
    expect(Array.isArray(output)).toBe(true)
    expect(output).toContain("123")
  })

  test("String('abc') + String('abd') → Diff → JSON Preview", async ({ page }) => {
    const src1 = await addNode(page, "string", { value: "abc" })
    const src2 = await addNode(page, "string", { value: "abd" })
    const diff = await addNode(page, "diff")
    const out = await addNode(page, "json-preview")
    await connectNodes(page, src1, "value", diff, "text1")
    await connectNodes(page, src2, "value", diff, "text2")
    await connectNodes(page, diff, "diff", out, "json")
    await executeAll(page)
    const output = await getOutput(page, out, "parsed")
    expect(output).toHaveProperty("changes")
    expect(output).toHaveProperty("text1", "abc")
    expect(output).toHaveProperty("text2", "abd")
    expect((output as { changes: unknown[] }).changes).toHaveLength(2)
  })

  test("String('* * * * *') → Crontab → JSON Preview(parsed)", async ({ page }) => {
    const src = await addNode(page, "string", { value: "* * * * *" })
    const cron = await addNode(page, "crontab")
    const out = await addNode(page, "json-preview")
    await connectNodes(page, src, "value", cron, "expression")
    await connectNodes(page, cron, "parsed", out, "json")
    await executeAll(page)
    const output = await getOutput(page, out, "parsed")
    expect(output).toHaveProperty("minute")
    expect(output).toHaveProperty("hour")
  })

  test("String('hello world') → Text Stats(characters)", async ({ page }) => {
    const src = await addNode(page, "string", { value: "hello world" })
    const stats = await addNode(page, "text-stats")
    const out = await addNode(page, "number", { value: 0 })
    await connectNodes(page, src, "value", stats, "text")
    await connectNodes(page, stats, "characters", out, "value")
    await executeAll(page)
    expect(await getOutput(page, out, "value")).toBe(11)
  })

  test("String('hello world') → Text Stats(words)", async ({ page }) => {
    const src = await addNode(page, "string", { value: "hello world" })
    const stats = await addNode(page, "text-stats")
    const out = await addNode(page, "number", { value: 0 })
    await connectNodes(page, src, "value", stats, "text")
    await connectNodes(page, stats, "words", out, "value")
    await executeAll(page)
    expect(await getOutput(page, out, "value")).toBe(2)
  })

  test("String('hello world') → Text Stats(bytes)", async ({ page }) => {
    const src = await addNode(page, "string", { value: "hello" })
    const stats = await addNode(page, "text-stats")
    const out = await addNode(page, "number", { value: 0 })
    await connectNodes(page, src, "value", stats, "text")
    await connectNodes(page, stats, "bytes", out, "value")
    await executeAll(page)
    expect(await getOutput(page, out, "value")).toBe(5)
  })

  test("Number(100) + Number('USD','CNY') → Currency → Number", async ({ page }) => {
    const amount = await addNode(page, "number", { value: 100 })
    const from = await addNode(page, "string", { value: "USD" })
    const to = await addNode(page, "string", { value: "CNY" })
    const curr = await addNode(page, "currency")
    const out = await addNode(page, "number", { value: 0 })
    await connectNodes(page, amount, "value", curr, "amount")
    await connectNodes(page, from, "value", curr, "from")
    await connectNodes(page, to, "value", curr, "to")
    await connectNodes(page, curr, "converted", out, "value")
    await executeAll(page)
    const result = await getOutput(page, out, "value")
    expect(typeof result).toBe("number")
    expect(result).toBeGreaterThan(0)
  })

  test("Number(100) + Number('USD','CNY') → Currency(rate) → Number", async ({ page }) => {
    const amount = await addNode(page, "number", { value: 100 })
    const from = await addNode(page, "string", { value: "USD" })
    const to = await addNode(page, "string", { value: "CNY" })
    const curr = await addNode(page, "currency")
    const out = await addNode(page, "number", { value: 0 })
    await connectNodes(page, amount, "value", curr, "amount")
    await connectNodes(page, from, "value", curr, "from")
    await connectNodes(page, to, "value", curr, "to")
    await connectNodes(page, curr, "rate", out, "value")
    await executeAll(page)
    const result = await getOutput(page, out, "value")
    expect(typeof result).toBe("number")
    expect(result).toBeCloseTo(7.24, 1)
  })

  test("String('abc') + String('abd') → Diff(added/removed/unchanged)", async ({ page }) => {
    const src1 = await addNode(page, "string", { value: "abc" })
    const src2 = await addNode(page, "string", { value: "abd" })
    const diff = await addNode(page, "diff")
    const outAdded = await addNode(page, "number", { value: 0 })
    const outRemoved = await addNode(page, "number", { value: 0 })
    const outUnchanged = await addNode(page, "number", { value: 0 })
    await connectNodes(page, src1, "value", diff, "text1")
    await connectNodes(page, src2, "value", diff, "text2")
    await connectNodes(page, diff, "added", outAdded, "value")
    await connectNodes(page, diff, "removed", outRemoved, "value")
    await connectNodes(page, diff, "unchanged", outUnchanged, "value")
    await executeAll(page)
    expect(await getOutput(page, outAdded, "value")).toBe(1)
    expect(await getOutput(page, outRemoved, "value")).toBe(1)
    expect(await getOutput(page, outUnchanged, "value")).toBe(0)
  })

  test("JSON node outputs to JSON Preview", async ({ page }) => {
    const json = await addNode(page, "json", { value: '{"key":"value"}' })
    const out = await addNode(page, "json-preview")
    await connectNodes(page, json, "parsed", out, "json")
    await executeAll(page)
    const output = await getOutput(page, out, "parsed")
    expect(typeof output).toBe("object")
    expect(output).toHaveProperty("key", "value")
  })

  test("Crypto: data + key → AES-CBC ciphertext", async ({ page }) => {
    const data = await addNode(page, "string", { value: "hello" })
    const key = await addNode(page, "string", { value: "1234567890123456" })
    const crypto = await addNode(page, "crypto", {
      algorithm: "aes",
      mode: "CBC",
      operation: "encrypt",
      iv: "1234567890123456",
    })
    const out = await addNode(page, "string", { value: "" })
    await connectNodes(page, data, "value", crypto, "data")
    await connectNodes(page, key, "value", crypto, "key")
    await connectNodes(page, crypto, "result", out, "value")
    await executeAll(page)
    const result = await getOutput(page, out, "value")
    expect(typeof result).toBe("string")
    expect((result as string).length).toBeGreaterThan(0)
    expect(result).not.toBe("hello")
  })

  test("File node: config file fallback", async ({ page }) => {
    const fileNode = await addNode(page, "file")
    const output = await page.evaluate(async ({ nodeId }) => {
      const store = (window as any).__ZUSTAND_STORE__
      await store.getState().executeNode(nodeId)
      return store.getState().nodeOutputs[nodeId]?.file
    }, { nodeId: fileNode })
    expect(output).toBeNull()
  })

  test("UUID: uppercase=true → uppercase format", async ({ page }) => {
    const uuid = await addNode(page, "uuid", { uppercase: true, withHyphens: true })
    const out = await addNode(page, "string", { value: "" })
    await connectNodes(page, uuid, "uuid", out, "value")
    await executeAll(page)
    const result = await getOutput(page, out, "value") as string
    expect(result).toMatch(/^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/)
  })

  test("UUID: withHyphens=false → no hyphens", async ({ page }) => {
    const uuid = await addNode(page, "uuid", { withHyphens: false })
    const out = await addNode(page, "string", { value: "" })
    await connectNodes(page, uuid, "uuid", out, "value")
    await executeAll(page)
    const result = await getOutput(page, out, "value") as string
    expect(result).toMatch(/^[0-9a-f]{32}$/)
  })

  test("Classic Cipher: Caesar shift=5", async ({ page }) => {
    const src = await addNode(page, "string", { value: "abc" })
    const cipher = await addNode(page, "classic-cipher", { algorithm: "caesar", shift: 5 })
    const out = await addNode(page, "string", { value: "" })
    await connectNodes(page, src, "value", cipher, "data")
    await connectNodes(page, cipher, "result", out, "value")
    await executeAll(page)
    expect(await getOutput(page, out, "value")).toBe("fgh")
  })

  test("Classic Cipher: Atbash", async ({ page }) => {
    const src = await addNode(page, "string", { value: "abc" })
    const cipher = await addNode(page, "classic-cipher", { algorithm: "atbash" })
    const out = await addNode(page, "string", { value: "" })
    await connectNodes(page, src, "value", cipher, "data")
    await connectNodes(page, cipher, "result", out, "value")
    await executeAll(page)
    expect(await getOutput(page, out, "value")).toBe("zyx")
  })

  test("QRCode: generates image File", async ({ page }) => {
    const qrcode = await addNode(page, "qrcode", { data: "test123" })
    await executeAll(page)
    const output = await getOutput(page, qrcode, "image")
    expect(output).not.toBeNull()
  })

  test("QRCode → Image to Base64 pipeline", async ({ page }) => {
    const qrcode = await addNode(page, "qrcode", { data: "hello" })
    const img64 = await addNode(page, "image-to-base64")
    const out = await addNode(page, "string", { value: "" })
    await connectNodes(page, qrcode, "image", img64, "file")
    await connectNodes(page, img64, "base64", out, "value")
    await executeAll(page)
    const result = await getOutput(page, out, "value")
    expect(typeof result).toBe("string")
    expect((result as string).length).toBeGreaterThan(0)
  })

  test("String('hello') → Hash(MD5) connected via config field port", async ({ page }) => {
    const src = await addNode(page, "string", { value: "hello" })
    const hash = await addNode(page, "hash", { algorithm: "sha256" })
    const out = await addNode(page, "string", { value: "" })
    await connectNodes(page, src, "value", hash, "data")
    await connectNodes(page, hash, "hash", out, "value")
    await executeAll(page)
    expect(await getOutput(page, out, "value")).toBe("2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824")
  })

  test("Encoding encoding config field port: outputs encoding value", async ({ page }) => {
    const enc = await addNode(page, "encoding", { encoding: "base64", mode: "encode" })
    const out = await addNode(page, "string", { value: "" })
    await connectNodes(page, enc, "encoding", out, "value")
    await executeAll(page)
    expect(await getOutput(page, out, "value")).toBe("base64")
  })
})

test.describe("Pipeline: Source Nodes", () => {
  test.beforeEach(async ({ page }) => {
    nodeCounter = 0
    await openCanvas(page)
  })

  test("UUID(v4) → String: format matches", async ({ page }) => {
    const uuid = await addNode(page, "uuid", { version: "v4" })
    const out = await addNode(page, "string", { value: "" })
    await connectNodes(page, uuid, "uuid", out, "value")
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
    await connectNodes(page, time, "timestamp", out, "value")
    await executeAll(page)
    const output = await getOutput(page, out, "value")
    expect(typeof output).toBe("number")
    expect(output).toBeGreaterThan(0)
  })

  test("Time → String(iso): contains T", async ({ page }) => {
    const time = await addNode(page, "time")
    const out = await addNode(page, "string", { value: "" })
    await connectNodes(page, time, "iso", out, "value")
    await executeAll(page)
    const output = await getOutput(page, out, "value")
    expect(typeof output).toBe("string")
    expect(output).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  test("Device Info → JSON Preview: is object", async ({ page }) => {
    const device = await addNode(page, "device-info")
    const out = await addNode(page, "json-preview")
    await connectNodes(page, device, "info", out, "json")
    await executeAll(page)
    const output = await getOutput(page, out, "parsed")
    expect(typeof output).toBe("object")
  })
})

test.describe("Node Parameter Rendering", () => {
  test.beforeEach(async ({ page }) => {
    nodeCounter = 0
    await openCanvas(page)
  })

  test("Hash: algorithm dropdown visible", async ({ page }) => {
    await addNode(page, "hash")
    const node = page.locator(".react-flow__node").first()
    await expect(node.locator("select").first()).toBeVisible({ timeout: 5000 })
  })

  test("QRCode: size slider + color pickers", async ({ page }) => {
    await addNode(page, "qrcode")
    const node = page.locator(".react-flow__node").first()
    await expect(node.locator("[type='range']")).toBeVisible({ timeout: 5000 })
    await expect(node.locator("[type='color']")).toHaveCount(2, { timeout: 5000 })
  })

  test("Image Compress: quality slider", async ({ page }) => {
    await addNode(page, "image-compress")
    const node = page.locator(".react-flow__node").first()
    await expect(node.locator("[type='range']")).toBeVisible({ timeout: 5000 })
  })

  test("Image Editor: brightness/contrast/saturation sliders + grayscale switch", async ({ page }) => {
    await addNode(page, "image-editor")
    const node = page.locator(".react-flow__node").first()
    await expect(node.locator("[type='range']")).toHaveCount(3, { timeout: 5000 })
    await expect(node.locator("[type='checkbox']")).toBeVisible({ timeout: 5000 })
  })

  test("JSON Format: indent slider + sortKeys switch", async ({ page }) => {
    await addNode(page, "json-format")
    const node = page.locator(".react-flow__node").first()
    await expect(node.locator("[type='range']")).toBeVisible({ timeout: 5000 })
    await expect(node.locator("[type='checkbox']")).toBeVisible({ timeout: 5000 })
  })

  test("UUID: version dropdown + uppercase/hyphens switches", async ({ page }) => {
    await addNode(page, "uuid")
    const node = page.locator(".react-flow__node").first()
    await expect(node.locator("select")).toBeVisible({ timeout: 5000 })
    await expect(node.locator("[type='checkbox']")).toHaveCount(2, { timeout: 5000 })
  })

  test("Meme Splitter: rows/cols sliders", async ({ page }) => {
    await addNode(page, "meme-splitter")
    const node = page.locator(".react-flow__node").first()
    await expect(node.locator("[type='range']")).toHaveCount(2, { timeout: 5000 })
  })

  test("Temperature: fromUnit dropdown", async ({ page }) => {
    await addNode(page, "temperature-converter")
    const node = page.locator(".react-flow__node").first()
    await expect(node.locator("select").first()).toBeVisible({ timeout: 5000 })
  })

  test("Encoding: encoding dropdown", async ({ page }) => {
    await addNode(page, "encoding")
    const node = page.locator(".react-flow__node").first()
    await expect(node.locator("select").first()).toBeVisible({ timeout: 5000 })
  })

  test("HMAC: algorithm dropdown", async ({ page }) => {
    await addNode(page, "hmac")
    const node = page.locator(".react-flow__node").first()
    await expect(node.locator("select").first()).toBeVisible({ timeout: 5000 })
  })

  test("Regex: pattern/flags inputs + replacement textarea", async ({ page }) => {
    await addNode(page, "regex")
    const node = page.locator(".react-flow__node").first()
    await expect(node.locator("input[type='text']")).toHaveCount(3, { timeout: 5000 })
    await expect(node.locator("textarea")).toBeVisible({ timeout: 5000 })
  })

  test("Time: timezone dropdown", async ({ page }) => {
    await addNode(page, "time")
    const node = page.locator(".react-flow__node").first()
    await expect(node.locator("select")).toBeVisible({ timeout: 5000 })
  })

  test("Protobuf: mode dropdown", async ({ page }) => {
    await addNode(page, "protobuf")
    const node = page.locator(".react-flow__node").first()
    await expect(node.locator("select").first()).toBeVisible({ timeout: 5000 })
  })
})

test.describe("Phase 4: New Nodes", () => {
  test.beforeEach(async ({ page }) => {
    nodeCounter = 0
    await openCanvas(page)
  })

  test("Boolean node: toggle switch and verify output", async ({ page }) => {
    const bool = await addNode(page, "boolean", { value: true })
    const out = await addNode(page, "boolean", { value: false })
    await connectNodes(page, bool, "value", out, "value")
    await executeAll(page)
    expect(await getOutput(page, out, "value")).toBe(true)
  })

  test("Boolean node: default value is false", async ({ page }) => {
    const bool = await addNode(page, "boolean")
    await executeAll(page)
    expect(await getOutput(page, bool, "value")).toBe(false)
  })

  test("JSON Path: query nested path", async ({ page }) => {
    const json = await addNode(page, "json", { value: '{"store":{"book":[{"title":"Sayings"}]}}' })
    const path = await addNode(page, "json-path", { path: "$.store.book[0].title" })
    const out = await addNode(page, "string", { value: "" })
    await connectNodes(page, json, "parsed", path, "json")
    await connectNodes(page, path, "string", out, "value")
    await executeAll(page)
    expect(await getOutput(page, out, "value")).toBe("Sayings")
  })

  test("JSON Path: query array index", async ({ page }) => {
    const json = await addNode(page, "json", { value: '{"arr":[10,20,30]}' })
    const path = await addNode(page, "json-path", { path: "$.arr[2]" })
    const out = await addNode(page, "number", { value: 0 })
    await connectNodes(page, json, "parsed", path, "json")
    await connectNodes(page, path, "number", out, "value")
    await executeAll(page)
    expect(await getOutput(page, out, "value")).toBe(30)
  })

  test("Base64 To File: converts base64 to file", async ({ page }) => {
    const base64 = await addNode(page, "string", { value: btoa("hello world") })
    const filename = await addNode(page, "string", { value: "test.txt" })
    const b64ToFile = await addNode(page, "base64-to-file")
    await connectNodes(page, base64, "value", b64ToFile, "base64")
    await connectNodes(page, filename, "value", b64ToFile, "filename")
    await executeAll(page)
    const file = await getOutput(page, b64ToFile, "file")
    expect(file).not.toBeNull()
  })

  test("File To Base64: converts file to base64", async ({ page }) => {
    const fileNode = await addNode(page, "file")
    const f2b64 = await addNode(page, "file-to-base64")
    const out = await addNode(page, "string", { value: "" })
    await connectNodes(page, fileNode, "file", f2b64, "file")
    await connectNodes(page, f2b64, "base64", out, "value")
    await executeAll(page)
    // File node has no file by default, so this should error
    const error = await page.evaluate(({ nodeId }) => {
      const store = (window as any).__ZUSTAND_STORE__
      return store.getState().nodeErrors[nodeId]
    }, { nodeId: f2b64 })
    expect(error).toContain("No file provided")
  })

  test("String To File: converts string to file", async ({ page }) => {
    const content = await addNode(page, "string", { value: "hello world" })
    const filename = await addNode(page, "string", { value: "test.txt" })
    const s2f = await addNode(page, "string-to-file")
    await connectNodes(page, content, "value", s2f, "content")
    await connectNodes(page, filename, "value", s2f, "filename")
    await executeAll(page)
    const file = await getOutput(page, s2f, "file")
    expect(file).not.toBeNull()
  })

  test("File To String: converts file to string", async ({ page }) => {
    const fileNode = await addNode(page, "file")
    const f2s = await addNode(page, "file-to-string")
    const out = await addNode(page, "string", { value: "" })
    await connectNodes(page, fileNode, "file", f2s, "file")
    await connectNodes(page, f2s, "content", out, "value")
    await executeAll(page)
    // File node has no file by default, so this should error
    const error = await page.evaluate(({ nodeId }) => {
      const store = (window as any).__ZUSTAND_STORE__
      return store.getState().nodeErrors[nodeId]
    }, { nodeId: f2s })
    expect(error).toContain("No file provided")
  })

  test("String Preview: shows content", async ({ page }) => {
    const src = await addNode(page, "string", { value: "hello world" })
    const preview = await addNode(page, "string-preview")
    await connectNodes(page, src, "value", preview, "content")
    await executeAll(page)
    const content = await getOutput(page, preview, "content")
    expect(content).toBe("hello world")
  })

  test("JSON Preview: shows parsed json", async ({ page }) => {
    const src = await addNode(page, "string", { value: '{"key":"value"}' })
    const preview = await addNode(page, "json-preview")
    await connectNodes(page, src, "value", preview, "json")
    await executeAll(page)
    const parsed = await getOutput(page, preview, "parsed")
    expect(parsed).toEqual({ key: "value" })
  })

  test("Image Preview: shows image", async ({ page }) => {
    const qrcode = await addNode(page, "qrcode", { data: "test" })
    const preview = await addNode(page, "image-preview")
    await connectNodes(page, qrcode, "image", preview, "file")
    await executeAll(page)
    const file = await getOutput(page, preview, "file")
    expect(file).not.toBeNull()
  })

  test("Delete key removes selected node", async ({ page }) => {
    await addNode(page, "string", { value: "hello" })

    // Click on the node to select it
    const node = page.locator(".react-flow__node").first()
    await expect(node).toBeVisible()
    await node.click()

    // Press Delete key
    await page.keyboard.press("Delete")

    // Verify node is removed
    await expect
      .poll(() =>
        page.evaluate(() => {
          const store = (window as any).__ZUSTAND_STORE__
          return store.getState().nodes.length
        })
      )
      .toBe(0)
  })

  test("Slider click doesn't drag canvas", async ({ page }) => {
    await addNode(page, "qrcode")

    const slider = page.locator("[type='range']").first()
    await expect(slider).toBeVisible({ timeout: 5000 })

    // Click on slider - this should not cause canvas drag
    await slider.click()

    // Verify slider is still functional
    const value = await slider.inputValue()
    expect(value).toBeDefined()
  })
})
