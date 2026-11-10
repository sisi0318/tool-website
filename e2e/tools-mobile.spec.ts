import { expect, test, type Page } from "@playwright/test"

test.use({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
})

/**
 * The site scrolls smoothly and, on a phone, has a sticky header, a sticky route bar and a floating
 * bottom bar. When one of them covers a click target, Playwright scrolls again with another
 * alignment, but it measures while the smooth scroll is still moving, so it bounces between "under
 * the header" and "under the bottom bar" until the test times out. The JSON test failed that way in
 * CI and in 9 of 24 local repeats. Scrolling instantly makes its retries land where they aim.
 */
const INSTANT_SCROLL = "html { scroll-behavior: auto !important; }"

async function openChineseTool(page: Page, path: string) {
  await page.addInitScript(() => window.localStorage.setItem("locale", "zh"))
  await page.goto(path, { waitUntil: "domcontentloaded" })
  await page.addStyleTag({ content: INSTANT_SCROLL })
  await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 30_000 })
}

async function expectNoPageOverflow(page: Page) {
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            Math.max(
              document.documentElement.scrollWidth,
              document.body.scrollWidth,
            ) <=
            window.innerWidth + 1,
        ),
      { timeout: 10_000 },
    )
    .toBe(true)
}

async function waitForReactHandler(page: Page, selector: string) {
  await page.waitForFunction(
    (targetSelector) => {
      const element = document.querySelector(targetSelector)
      return (
        element !== null &&
        Object.keys(element).some((key) => key.startsWith("__reactProps$"))
      )
    },
    selector,
    { timeout: 30_000 },
  )
}

const sampleImage = {
  name: "sample.svg",
  mimeType: "image/svg+xml",
  buffer: Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="400" height="300">
      <rect width="400" height="300" fill="white"/>
      <g fill="#6750a4">
        <rect x="8" y="8" width="88" height="88"/>
        <rect x="104" y="8" width="88" height="88"/>
        <rect x="200" y="8" width="88" height="88"/>
        <rect x="296" y="8" width="88" height="88"/>
        <rect x="8" y="104" width="88" height="88"/>
        <rect x="104" y="104" width="88" height="88"/>
        <rect x="200" y="104" width="88" height="88"/>
        <rect x="296" y="104" width="88" height="88"/>
        <rect x="8" y="200" width="88" height="88"/>
        <rect x="104" y="200" width="88" height="88"/>
        <rect x="200" y="200" width="88" height="88"/>
        <rect x="296" y="200" width="88" height="88"/>
      </g>
    </svg>
  `),
}

test.describe("mobile tool layouts", () => {
  for (const path of [
    "/tools/device",
    "/tools/qrcode-decode",
    "/tools/whois",
    "/tools/image-coordinates",
  ]) {
    test(`${path} has no page-level horizontal overflow`, async ({ page }) => {
      await openChineseTool(page, path)
      await expectNoPageOverflow(page)
    })
  }

  test("image editor supports pointer cropping without mobile overflow", async ({
    page,
  }) => {
    await openChineseTool(page, "/tools/image-editor")
    await waitForReactHandler(page, 'input[type="file"]')
    await page.locator('input[type="file"]').setInputFiles(sampleImage)
    await expect(page.locator("canvas")).toBeVisible({ timeout: 15_000 })
    await page.getByRole("button", { name: "开始裁剪" }).click()

    const canvas = page.locator("canvas")
    await canvas.scrollIntoViewIfNeeded()
    await expect(canvas).toBeInViewport()
    const box = await canvas.boundingBox()
    expect(box).not.toBeNull()
    await page.mouse.move(box!.x + box!.width * 0.2, box!.y + box!.height * 0.2)
    await page.mouse.down()
    await page.mouse.move(box!.x + box!.width * 0.75, box!.y + box!.height * 0.75, {
      steps: 8,
    })
    await page.mouse.up()
    await page.getByRole("button", { name: "应用", exact: true }).click()

    const outputSize = page.locator("dt", { hasText: "导出尺寸" }).locator("..")
    await expect(outputSize).not.toContainText("400 × 300")
    await expectNoPageOverflow(page)
  })

  test("meme splitter detects and renders a grid on mobile", async ({ page }) => {
    await openChineseTool(page, "/tools/meme-splitter")
    await waitForReactHandler(page, 'input[type="file"]')
    await page.locator('input[type="file"]').setInputFiles(sampleImage)
    await page.getByRole("button", { name: "开始切分" }).click()

    await expect(page.getByText("切分结果", { exact: true })).toBeVisible({
      timeout: 30_000,
    })
    await expect(page.getByText("12 个切片", { exact: true })).toBeVisible()
    await expectNoPageOverflow(page)
  })

  test("hash output format is usable and results wrap on mobile", async ({
    page,
  }) => {
    await openChineseTool(page, "/tools/hash")
    await waitForReactHandler(page, "#hash-input")
    await page.locator("#hash-input").fill("abc")
    await page.getByRole("button", { name: "计算哈希" }).click()
    await expect(page.getByText("900150983cd24fb0d6963f7d28e17f72")).toBeVisible()

    await page.getByLabel("Base64", { exact: true }).click()
    await page.getByRole("button", { name: "计算哈希" }).click()
    await expect(page.getByText("kAFQmDzST7DWlj99KOF/cg==")).toBeVisible()
    await expectNoPageOverflow(page)
  })

  test("AES text encryption and decryption round-trip on mobile", async ({
    page,
  }) => {
    await openChineseTool(page, "/tools/crypto")
    await waitForReactHandler(page, "#crypto-input")
    await page.getByRole("button", { name: "生成密钥" }).click()
    await page.getByRole("button", { name: "生成IV" }).click()
    await page.locator("#crypto-input").fill("hello")
    await page.getByRole("button", { name: "立即加密" }).click()

    // 加密是异步的,先等输出落定再读,否则读到的是上一帧的空值
    await expect(page.locator("#crypto-output")).toHaveValue(/^[0-9a-f]+$/)
    const encrypted = await page.locator("#crypto-output").inputValue()
    await page.locator("#crypto-operation-decrypt").click()
    await page.locator("#crypto-input").fill(encrypted)
    await page.getByRole("button", { name: "立即解密" }).click()
    await expect(page.locator("#crypto-output")).toHaveValue("hello")
    await expectNoPageOverflow(page)
  })

  test("JSON actions appear once on mobile and the toolbar shows real labels", async ({
    page,
  }) => {
    await openChineseTool(page, "/tools/json")
    await waitForReactHandler(page, "#json-editor")

    // the row under the editor replaces the "basic actions" card on narrow screens; both used to show
    for (const name of ["格式化", "压缩", "折叠", "清空"]) {
      await expect(page.getByRole("button", { name, exact: true })).toHaveCount(1)
    }
    // these two once rendered their translation keys ("common.paste", "common.loadSample")
    await expect(page.getByRole("button", { name: "粘贴", exact: true })).toBeVisible()
    await expect(page.getByRole("button", { name: "示例", exact: true })).toBeVisible()
    await expect(page.getByText(/common\.\w+/)).toHaveCount(0)

    await page.locator("#json-editor").fill('{"b":1,"a":2}')
    await page.getByRole("button", { name: "压缩", exact: true }).click()
    await expect(page.locator("#json-editor")).toHaveValue('{"b":1,"a":2}')
    await page.getByRole("button", { name: "格式化", exact: true }).click()
    await expect(page.locator("#json-editor")).toHaveValue('{\n  "b": 1,\n  "a": 2\n}')
    await expectNoPageOverflow(page)
  })

  test("small-text inputs use 16px on touch screens so iOS does not zoom on focus", async ({
    page,
  }) => {
    await openChineseTool(page, "/tools/xml")
    const input = page.locator("[data-workbench-input]")
    await expect(input).toBeVisible()
    // the workbench textarea is styled text-sm (14px) and would trigger iOS auto-zoom
    expect(await input.evaluate((element) => getComputedStyle(element).fontSize)).toBe("16px")
  })
})
