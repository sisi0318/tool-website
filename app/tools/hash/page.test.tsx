import React from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import HashPage from "./page"

vi.mock("@/hooks/use-translations", () => { const translate = (key: string) => key; return { useTranslations: () => translate } })
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock("@/components/tools/send-to-menu", () => ({ SendToMenu: () => null }))

describe("hash file input", () => {
  beforeEach(() => window.localStorage.clear())

  it("lets another file be dropped onto the chosen one to replace it", async () => {
    render(<HashPage />)
    const fileTab = screen.getByRole("tab", { name: "fileMode" })
    fireEvent.mouseDown(fileTab)
    await waitFor(() => expect(fileTab).toHaveAttribute("aria-selected", "true"))

    fireEvent.drop(screen.getByRole("button", { name: /dropFileHere/ }), { dataTransfer: { files: [new File(["a"], "first.txt")] } })
    expect(screen.getByText("first.txt")).toBeInTheDocument()

    fireEvent.drop(screen.getByText("first.txt"), { dataTransfer: { files: [new File(["b"], "second.txt")] } })
    expect(screen.getByText("second.txt")).toBeInTheDocument()
    expect(screen.queryByText("first.txt")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "replaceFile" })).toBeInTheDocument()
  })
})
