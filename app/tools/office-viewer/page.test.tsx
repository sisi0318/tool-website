import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import OfficeViewerPage from "./page"

const readSpreadsheet = vi.hoisted(() => vi.fn())
vi.mock("@/lib/spreadsheet", () => ({ readSpreadsheet }))
vi.mock("@/hooks/use-translations", () => { const translate = (key: string) => key; return { useTranslations: () => translate } })

describe("spreadsheet preview", () => {
  it("parses off the main thread and renders a long sheet one page at a time", async () => {
    const rows = Array.from({ length: 1200 }, (_, index) => [`row ${index + 1}`, "b", "c"])
    readSpreadsheet.mockResolvedValue([{ name: "Data", rows, columnCount: 3 }])
    const { container } = render(<OfficeViewerPage />)
    const file = new File(["x"], "big.xlsx")
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [file] } })

    expect(await screen.findByText("row 500")).toBeInTheDocument()
    expect(readSpreadsheet).toHaveBeenCalledWith(file, expect.objectContaining({ signal: expect.any(AbortSignal) }))
    expect(screen.queryByText("row 501")).not.toBeInTheDocument()
    expect(container.querySelectorAll("tbody tr")).toHaveLength(500)
    // 统计：总行数 1200，列数取自解析结果
    expect(screen.getByText("rowCount").parentElement).toHaveTextContent(/^rowCount1200$/)
    expect(screen.getByText("columnCount").parentElement).toHaveTextContent(/^columnCount3$/)

    fireEvent.click(screen.getByRole("button", { name: "nextRows" }))
    expect(screen.getByText("row 501")).toBeInTheDocument()
    expect(screen.queryByText("row 500")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "nextRows" }))
    expect(container.querySelectorAll("tbody tr")).toHaveLength(200)
    expect(screen.getByRole("button", { name: "nextRows" })).toBeDisabled()
  })
})
