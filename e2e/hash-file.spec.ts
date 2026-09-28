import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { expect, test } from "@playwright/test"

const buffer = readFileSync("public/icons/icon-192.png")
const digest = (algorithm: string) => createHash(algorithm).update(buffer).digest("hex")

test("文件哈希在 Worker 里计算，结果与 Node 一致", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("locale", "zh"))
  await page.goto("/tools/hash", { waitUntil: "domcontentloaded" })
  await page.getByRole("tab", { name: /文件模式/ }).click()
  await page.waitForFunction(() => {
    const input = document.querySelector('input[type="file"]')
    return input && Object.keys(input).some((key) => key.startsWith("__reactProps$"))
  })
  await page.locator('input[type="file"]').setInputFiles({ name: "icon.png", mimeType: "image/png", buffer })

  const worker = page.waitForEvent("worker")
  await page.getByRole("button", { name: "计算哈希" }).click()
  await worker
  await expect(page.getByText(digest("md5"), { exact: true })).toBeVisible()

  // 显示所有算法：同一次读文件算出二十来种
  await page.getByRole("switch", { name: "显示所有算法结果" }).click()
  await page.getByRole("button", { name: "计算哈希" }).click()
  await expect(page.getByText(digest("sha256"), { exact: true })).toBeVisible()
  await expect(page.getByText(digest("sha3-512"), { exact: true })).toBeVisible()
})
