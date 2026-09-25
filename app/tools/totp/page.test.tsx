import React, { type ReactElement } from "react"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import TOTPPage from "./page"

const toast = vi.fn()
vi.mock("@/hooks/use-translations", () => { const translate = (key: string) => key; return { useTranslations: () => translate } })
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }))

const SHA256_SEED = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZA"

function openAddForm() {
  fireEvent.click(screen.getAllByRole("button", { name: "addAccount" })[0])
}

describe("TOTP page", () => {
  beforeEach(() => {
    localStorage.clear()
    toast.mockClear()
  })

  it("names the secret characters that are not Base32 instead of dropping them", () => {
    render(<TOTPPage />)
    openAddForm()
    fireEvent.change(screen.getByLabelText("accountName"), { target: { value: "bob" } })
    fireEvent.change(screen.getByLabelText("secret"), { target: { value: "JBSW Y3D0" } })
    fireEvent.submit(screen.getByLabelText("secret").closest("form")!)
    expect(screen.getByRole("alert")).toHaveTextContent("invalidSecretCharacters")
    expect(screen.getByLabelText("secret")).toHaveAttribute("aria-invalid", "true")
    expect(localStorage.getItem("totp_accounts")).toBeNull()
  })

  it("adds an account with the chosen algorithm from the form", () => {
    render(<TOTPPage />)
    openAddForm()
    fireEvent.change(screen.getByLabelText("accountName"), { target: { value: "bob" } })
    fireEvent.change(screen.getByLabelText("secret"), { target: { value: SHA256_SEED.toLowerCase() } })
    fireEvent.change(screen.getByLabelText("algorithm"), { target: { value: "SHA256" } })
    fireEvent.submit(screen.getByLabelText("secret").closest("form")!)
    expect(screen.getByText("bob")).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem("totp_accounts")!)[0]).toMatchObject({ name: "bob", secret: SHA256_SEED, algorithm: "SHA256", digits: 6, period: 30 })
  })

  it("explains why an otpauth link cannot be imported", () => {
    render(<TOTPPage />)
    openAddForm()
    fireEvent.change(screen.getByLabelText("importFromUri"), { target: { value: `otpauth://totp/Svc:bob?secret=${SHA256_SEED}&algorithm=MD5` } })
    fireEvent.submit(screen.getByLabelText("importFromUri").closest("form")!)
    expect(screen.getByRole("alert")).toHaveTextContent("unsupportedAlgorithm")
  })

  it("lets a deleted account be restored from the toast", () => {
    localStorage.setItem("totp_accounts", JSON.stringify([
      { id: "a", name: "first", issuer: "", secret: "JBSWY3DPEHPK3PXP", digits: 6, period: 30 },
      { id: "b", name: "second", issuer: "", secret: "JBSWY3DPEHPK3PXP", digits: 6, period: 30 },
    ]))
    render(<TOTPPage />)
    fireEvent.click(screen.getAllByRole("button", { name: "deleteAccount" })[0])
    expect(screen.queryByText("first")).not.toBeInTheDocument()

    const action = toast.mock.calls.at(-1)![0].action as ReactElement<{ onClick: () => void }>
    act(() => { action.props.onClick() })
    const names = screen.getAllByText(/^(first|second)$/).map((node) => node.textContent)
    expect(names).toEqual(["first", "second"])
  })
})
