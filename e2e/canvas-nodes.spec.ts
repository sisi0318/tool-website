import { expect, test, type Page } from "@playwright/test"

let nodeCounter = 0

async function openCanvas(page: Page) {
  await page.goto("/canvas", { waitUntil: "domcontentloaded" })
  await expect(page.locator(".react-flow")).toBeVisible({ timeout: 15_000 })
}

async function addNode(page: Page, type: string): Promise<string> {
  const id = `${type}-${++nodeCounter}`
  await page.evaluate(
    ({ id, type }) => {
      const store = (window as any).__ZUSTAND_STORE__
      store.getState().addNode({
        id,
        type,
        position: { x: 320, y: 220 },
        config: {},
      })
    },
    { id, type }
  )
  return id
}

const NODE_PORTS: Record<string, { inputs: number; outputs: number }> = {
  string: { inputs: 1, outputs: 1 },
  number: { inputs: 1, outputs: 1 },
  json: { inputs: 1, outputs: 1 },
  file: { inputs: 1, outputs: 1 },
  hash: { inputs: 1, outputs: 2 },
  hmac: { inputs: 4, outputs: 3 },
  crypto: { inputs: 6, outputs: 5 },
  encoding: { inputs: 3, outputs: 3 },
  "classic-cipher": { inputs: 3, outputs: 3 },
  jwt: { inputs: 1, outputs: 3 },
  "json-format": { inputs: 3, outputs: 4 },
  protobuf: { inputs: 3, outputs: 3 },
  jce: { inputs: 2, outputs: 2 },
  "image-to-base64": { inputs: 2, outputs: 3 },
  "exif-viewer": { inputs: 2, outputs: 2 },
  "image-compress": { inputs: 3, outputs: 4 },
  "image-editor": { inputs: 5, outputs: 5 },
  qrcode: { inputs: 5, outputs: 6 },
  "qrcode-decode": { inputs: 1, outputs: 1 },
  "meme-splitter": { inputs: 3, outputs: 3 },
  "image-coordinates": { inputs: 1, outputs: 1 },
  "text-stats": { inputs: 1, outputs: 6 },
  "case-converter": { inputs: 1, outputs: 6 },
  regex: { inputs: 4, outputs: 5 },
  diff: { inputs: 2, outputs: 5 },
  "http-tester": { inputs: 4, outputs: 4 },
  crontab: { inputs: 1, outputs: 2 },
  "docker-converter": { inputs: 2, outputs: 3 },
  whois: { inputs: 1, outputs: 1 },
  uuid: { inputs: 3, outputs: 4 },
  totp: { inputs: 1, outputs: 2 },
  color: { inputs: 1, outputs: 3 },
  "base-converter": { inputs: 2, outputs: 5 },
  "temperature-converter": { inputs: 3, outputs: 5 },
  currency: { inputs: 3, outputs: 4 },
  bmi: { inputs: 2, outputs: 2 },
  "device-info": { inputs: 0, outputs: 1 },
  "office-viewer": { inputs: 1, outputs: 1 },
  time: { inputs: 1, outputs: 5 },
}

test.describe("Canvas node ports", () => {
  test.beforeEach(async ({ page }) => {
    nodeCounter = 0
    await openCanvas(page)
  })

  test("registered adapters render their declared ports", async ({ page }) => {
    for (const [nodeType, expected] of Object.entries(NODE_PORTS)) {
      await test.step(
        `${nodeType}: ${expected.inputs} inputs, ${expected.outputs} outputs`,
        async () => {
          const nodeId = await addNode(page, nodeType)
          const node = page.locator(`.react-flow__node[data-id="${nodeId}"]`)
          await expect(node).toHaveCount(1)
          await expect(
            node.locator(".react-flow__handle[data-handlepos='left']")
          ).toHaveCount(expected.inputs)
          await expect(
            node.locator(".react-flow__handle[data-handlepos='right']")
          ).toHaveCount(expected.outputs)

          await page.evaluate((id) => {
            const store = (window as any).__ZUSTAND_STORE__
            store.getState().removeNode(id)
          }, nodeId)
          await expect(node).toHaveCount(0)
        }
      )
    }
  })
})
