import * as React from "react"
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { FileEditor } from "./FileEditor"

describe("FileEditor", () => {
  it("renders upload area when not disabled", () => {
    render(<FileEditor disabled={false} file={null} onFileChange={vi.fn()} />)
    expect(screen.getByTestId("file-upload-area")).toBeInTheDocument()
    expect(screen.getByText("Click to upload file")).toBeInTheDocument()
  })

  it("renders file name when disabled and file exists", () => {
    const file = new File(["content"], "test.txt", { type: "text/plain" })
    render(<FileEditor disabled={true} file={file} onFileChange={vi.fn()} />)
    expect(screen.getByTestId("file-name-display")).toBeInTheDocument()
    expect(screen.getByText("test.txt")).toBeInTheDocument()
  })

  it("renders 'No file' when disabled and no file", () => {
    render(<FileEditor disabled={true} file={null} onFileChange={vi.fn()} />)
    expect(screen.getByText("No file")).toBeInTheDocument()
  })

  it("shows file name in upload area when file exists", () => {
    const file = new File(["content"], "test.txt", { type: "text/plain" })
    render(<FileEditor disabled={false} file={file} onFileChange={vi.fn()} />)
    expect(screen.getByText("test.txt")).toBeInTheDocument()
  })

  it("disables download button when no file", () => {
    render(<FileEditor disabled={false} file={null} onFileChange={vi.fn()} />)
    expect(screen.getByTestId("file-download-btn")).toBeDisabled()
  })

  it("enables download button when file exists", () => {
    const file = new File(["content"], "test.txt", { type: "text/plain" })
    render(<FileEditor disabled={false} file={file} onFileChange={vi.fn()} />)
    expect(screen.getByTestId("file-download-btn")).not.toBeDisabled()
  })

  it("calls onFileChange when file is selected", () => {
    const onFileChange = vi.fn()
    render(<FileEditor disabled={false} file={null} onFileChange={onFileChange} />)
    const file = new File(["content"], "test.txt", { type: "text/plain" })
    const input = screen.getByTestId("file-input")
    fireEvent.change(input, { target: { files: [file] } })
    expect(onFileChange).toHaveBeenCalledWith(file)
  })

  it("has correct test id", () => {
    render(<FileEditor disabled={false} file={null} onFileChange={vi.fn()} />)
    expect(screen.getByTestId("inline-editor-file")).toBeInTheDocument()
  })
})
