import { expect, test } from "@playwright/test"
import { readFileSync } from "node:fs"

const sampleImage = {
  name: "icon.png",
  mimeType: "image/png",
  buffer: readFileSync("public/icons/icon-192.png"),
}

test("image compression runs in the worker, follows the settings and downloads one ZIP", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("locale", "zh"))
  await page.goto("/tools/image-compress", { waitUntil: "domcontentloaded" })
  await page.waitForFunction(() => {
    const input = document.querySelector('input[type="file"]')
    return input && Object.keys(input).some((key) => key.startsWith("__reactProps$"))
  })

  await page.locator('input[type="file"]').setInputFiles(sampleImage)
  const compressed = page.locator('img[alt="压缩后"]')
  await expect(compressed).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText("192 × 192", { exact: true }).first()).toBeVisible()

  const describe = () => compressed.evaluate(async (image) => {
    await (image as HTMLImageElement).decode()
    const blob = await (await fetch((image as HTMLImageElement).src)).blob()
    return { type: blob.type, width: (image as HTMLImageElement).naturalWidth }
  })
  // 自动优化：PNG 转成 WebP
  expect(await describe()).toEqual({ type: "image/webp", width: 192 })

  await page.getByRole("spinbutton", { name: "最大宽度" }).fill("96")
  await expect.poll(async () => (await describe()).width, { timeout: 15_000 }).toBe(96)

  const download = page.waitForEvent("download")
  await page.getByRole("button", { name: "打包下载全部（ZIP）" }).click()
  expect((await download).suggestedFilename()).toBe("compressed-images.zip")
})
