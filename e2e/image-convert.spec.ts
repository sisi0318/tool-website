import { expect, test } from "@playwright/test"
import { readFileSync } from "node:fs"

const sampleImage = {
  name: "single-frame-source.png",
  mimeType: "image/png",
  buffer: readFileSync("public/icons/icon-192.png"),
}

test("image converter creates a browser-decodable single-frame GIF", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("locale", "zh"))
  await page.goto("/tools/image-convert", { waitUntil: "domcontentloaded" })
  await page.waitForFunction(() => {
    const input = document.querySelector('input[type="file"]')
    return input && Object.keys(input).some((key) => key.startsWith("__reactProps$"))
  })

  await page.locator('input[type="file"]').setInputFiles(sampleImage)
  const preview = page.locator('img[alt="single-frame-source.png"]')
  const sourceUrl = await preview.getAttribute("src")

  await page.locator('button[role="combobox"]').first().click()
  await page.getByRole("option", { name: "GIF（单帧）", exact: true }).click()
  await expect(page.getByText("输出为静态单帧 GIF", { exact: false })).toBeVisible()
  await page.getByRole("button", { name: "转换全部图片" }).click()

  await expect(page.getByText("single-frame-source.gif", { exact: true })).toBeVisible()
  await expect.poll(() => preview.getAttribute("src")).not.toBe(sourceUrl)

  const result = await preview.evaluate(async (image) => {
    await (image as HTMLImageElement).decode()
    const response = await fetch((image as HTMLImageElement).src)
    const blob = await response.blob()
    const bytes = new Uint8Array(await blob.arrayBuffer())
    return {
      signature: String.fromCharCode(...bytes.subarray(0, 6)),
      trailer: bytes[bytes.length - 1],
      mimeType: blob.type,
      width: (image as HTMLImageElement).naturalWidth,
      height: (image as HTMLImageElement).naturalHeight,
    }
  })

  expect(result).toEqual({
    signature: "GIF89a",
    trailer: 0x3b,
    mimeType: "image/gif",
    width: 192,
    height: 192,
  })
})
