import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ConfirmDialog } from "./ConfirmDialog"

vi.mock("@/hooks/use-translations", () => ({
  useTranslations: () => (key: string) => ({
    cancel: "Cancel",
    confirm: "Confirm",
  }[key] ?? key),
}))

describe("ConfirmDialog", () => {
  it("uses an accessible alert dialog and handles both actions", () => {
    const onCancel = vi.fn()
    const onConfirm = vi.fn()
    const { unmount } = render(
      <ConfirmDialog
        title="Clear canvas"
        message="This cannot be undone."
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    )

    expect(screen.getByRole("alertdialog", { name: "Clear canvas" })).toBeInTheDocument()
    expect(screen.getByText("This cannot be undone.")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
    expect(onCancel).toHaveBeenCalledTimes(1)

    unmount()
    render(
      <ConfirmDialog
        title="Clear canvas"
        message="This cannot be undone."
        confirmLabel="Clear"
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    )
    fireEvent.click(screen.getByRole("button", { name: "Clear" }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it("closes with Escape", () => {
    const onCancel = vi.fn()
    render(
      <ConfirmDialog
        title="Clear canvas"
        message="This cannot be undone."
        onCancel={onCancel}
        onConfirm={vi.fn()}
      />
    )

    fireEvent.keyDown(screen.getByRole("alertdialog"), { key: "Escape" })
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
