import React, { useState } from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { StructuredDiffPanel } from "./structured-diff-panel"
vi.mock("@/components/tools/send-to-menu", () => ({ SendToMenu: () => null }))

vi.mock("@/hooks/use-translations", () => {
  const translate = (key: string) => key
  return { useTranslations: () => translate }
})

function Panel({ initialLeft = "", initialRight = "" }: { initialLeft?: string; initialRight?: string }) {
  const [left, setLeft] = useState(initialLeft)
  const [right, setRight] = useState(initialRight)
  return <StructuredDiffPanel left={left} right={right} onLeftChange={setLeft} onRightChange={setRight} />
}

describe("structured diff panel", () => {
  it("compares the sample by id, ignoring timestamps, and clears stale results on edits", async () => {
    render(<Panel />)
    fireEvent.click(screen.getByRole("button", { name: "sample" }))
    await waitFor(() => expect(screen.getByText('$.users[id="a"].role')).toBeInTheDocument())
    expect(screen.getByText('"reader"')).toBeInTheDocument()
    expect(screen.getByText('"admin"')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText("right"), { target: { value: "{" } })
    expect(screen.queryByText('$.users[id="a"].role')).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("right · errors.invalidInput"))
  })
  it("does not show changes for object key order and supports YAML", async () => {
    render(<Panel initialLeft={"a: 1\nb: 2"} initialRight={"b: 2\na: 1"} />)
    fireEvent.change(screen.getByRole("combobox", { name: "format" }), { target: { value: "yaml" } })
    await waitFor(() => expect(screen.getByText("equal")).toBeInTheDocument())
  })
})
