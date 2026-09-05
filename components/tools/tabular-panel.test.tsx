import React from "react"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import TabularPanel from "./tabular-panel"

const files = vi.hoisted(() => ({ latest: null as File | null }))
vi.mock("@/hooks/use-object-url", () => ({ useObjectUrl: (file: File | null) => { files.latest = file; return file ? "blob:test-export" : null } }))
vi.mock("@/components/tools/send-to-menu", () => ({ SendToMenu: () => null }))
vi.mock("@/components/json-tree-view", () => ({ JsonTreeView: ({ jsonText }: { jsonText: string }) => <pre data-testid="row-json">{jsonText}</pre> }))
vi.mock("@/hooks/use-translations", () => { const translate = (key: string) => key; return { useTranslations: () => translate } })
vi.mock("@/components/ui/select", () => ({
  Select: ({ value, onValueChange, children }: { value: string; onValueChange: (value: string) => void; children: React.ReactNode }) => {
    const items = React.Children.toArray(children) as React.ReactElement<{ "aria-label"?: string; children?: React.ReactNode }>[]
    return <select aria-label={items[0].props["aria-label"]} value={value} onChange={(event) => onValueChange(event.target.value)}>{items[1].props.children}</select>
  }, SelectTrigger: () => null, SelectValue: () => null, SelectContent: () => null,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => <option value={value}>{children}</option>,
}))

function readFile(file: File): Promise<string> { return new Promise((resolve) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.readAsText(file) }) }

describe("tabular panel", () => {
  it("filters sample logs, groups counts, inspects rows and invalidates stale output", async () => {
    render(<TabularPanel />)
    fireEvent.click(screen.getByRole("button", { name: "sample" }))
    fireEvent.click(screen.getByRole("button", { name: "parse" }))
    await screen.findByRole("table")
    expect(screen.getByText("errorsTitle · 1")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "addFilter" }))
    fireEvent.change(screen.getByRole("combobox", { name: "filterColumn 1" }), { target: { value: "2" } })
    fireEvent.change(screen.getByRole("combobox", { name: "operator 1" }), { target: { value: "gte" } })
    fireEvent.change(screen.getByRole("textbox", { name: "value 1" }), { target: { value: "500" } })
    await waitFor(() => expect(screen.getAllByRole("row")).toHaveLength(4))
    fireEvent.change(screen.getByRole("combobox", { name: "groupBy" }), { target: { value: "1" } })
    await waitFor(() => expect(screen.getAllByRole("row")).toHaveLength(3))
    expect(await readFile(files.latest!)).toBe('[{"service":"api","count":2},\n{"service":"web","count":1}]')
    fireEvent.click(screen.getByRole("button", { name: "inspectRow 2" }))
    expect(screen.getByTestId("row-json")).toHaveTextContent('{"service":"api","count":2}')
    fireEvent.change(screen.getByRole("textbox", { name: "input" }), { target: { value: "bad" } })
    expect(screen.queryByRole("table")).not.toBeInTheDocument(); expect(screen.queryByRole("link", { name: "download" })).not.toBeInTheDocument()
  })
  it("paginates preview while exporting every row and applies column selection", async () => {
    render(<TabularPanel />)
    fireEvent.change(screen.getByRole("textbox", { name: "input" }), { target: { value: Array.from({ length: 52 }, (_, index) => JSON.stringify({ id: index, status: 200 })).join("\n") } })
    fireEvent.click(screen.getByRole("button", { name: "parse" }))
    await screen.findByRole("table")
    expect(screen.getAllByRole("row")).toHaveLength(51)
    expect(JSON.parse(await readFile(files.latest!))).toHaveLength(52)
    fireEvent.click(screen.getByRole("button", { name: "nextPage", exact: true }))
    expect(screen.getAllByRole("row")).toHaveLength(3)
    expect(within(screen.getByRole("table")).getByText("51", { selector: "td" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("checkbox", { name: "status" }))
    await waitFor(() => expect(screen.getAllByRole("columnheader")).toHaveLength(2))
    expect(JSON.parse(await readFile(files.latest!))[51]).toEqual({ id: 51 })
  })
})
