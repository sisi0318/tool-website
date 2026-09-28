import { expect, test } from "@playwright/test"
import * as XLSX from "xlsx"

function spreadsheet(): Buffer {
  const rows: unknown[][] = [["名称", "日期"], ["示例", new Date(2024, 0, 2)]]
  for (let row = 3; row <= 702; row += 1) rows.push([`行 ${row}`, row])
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), "数据")
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer
}

test("Excel 在 Worker 里解析，日期按格式显示，长表格分页", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("locale", "zh"))
  await page.goto("/tools/office-viewer", { waitUntil: "domcontentloaded" })
  await page.waitForFunction(() => {
    const input = document.querySelector('input[type="file"]')
    return input && Object.keys(input).some((key) => key.startsWith("__reactProps$"))
  })

  const worker = page.waitForEvent("worker")
  await page.locator('input[type="file"]').setInputFiles({
    name: "data.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: spreadsheet(),
  })
  await worker

  const sampleRow = page.locator("tr", { hasText: "示例" })
  await expect(sampleRow).toBeVisible()
  // 日期显示成表格里的格式，而不是 45293 这样的序号
  await expect(sampleRow).toContainText(/\d{1,2}\/\d{1,2}\/\d{2,4}/)
  await expect(page.getByText("第 1–500 行，共 702 行")).toBeVisible()
  await expect(page.getByText("行 500", { exact: true })).toBeVisible()
  await expect(page.getByText("行 501", { exact: true })).toHaveCount(0)

  await page.getByRole("button", { name: "下一页" }).click()
  await expect(page.getByText("行 501", { exact: true })).toBeVisible()
  await expect(page.getByText("第 501–702 行，共 702 行")).toBeVisible()
})
