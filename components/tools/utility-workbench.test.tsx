import React, { type ReactElement } from "react"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { UtilityWorkbench } from "./utility-workbench"
vi.mock("@/components/tools/send-to-menu", () => ({ SendToMenu: () => null }))
const toast = vi.fn()
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }))

vi.mock("@/hooks/use-translations", () => ({
  useTranslations: () => (key: string) => ({
    inputSettings: "Input and settings",
    operation: "Operation",
    input: "Input",
    output: "Output",
    characters: "{count} characters",
    run: "Run",
    sample: "Sample",
    clear: "Clear",
    copy: "Copy",
    copied: "Copied",
    copyFailed: "Copy failed",
    processing: "Processing",
    inputPlaceholder: "Input placeholder",
    outputPlaceholder: "Output placeholder",
  }[key] ?? key),
}))

afterEach(() => {
  vi.restoreAllMocks()
})

describe("UtilityWorkbench mobile layout", () => {
  it("uses usable mobile editor heights and a predictable action grid", () => {
    render(
      <UtilityWorkbench
        title="Demo tool"
        description="Demo description"
        icon={<span>Icon</span>}
        input=""
        output=""
        operation="convert"
        operations={[{ value: "convert", label: "Convert" }]}
        onInputChange={() => undefined}
        onOperationChange={() => undefined}
        onRun={() => undefined}
        onClear={() => undefined}
        onSample={() => undefined}
      />,
    )

    const [input, output] = screen.getAllByRole("textbox")
    expect(input).toHaveClass("min-h-40", "sm:min-h-64")
    expect(output).toHaveClass("min-h-48", "sm:min-h-[26rem]")
    expect(screen.getByRole("button", { name: "Run" })).toHaveClass("col-span-2", "w-full")
    expect(screen.getByRole("button", { name: "Sample" })).toHaveClass("w-full")
    expect(screen.getByRole("button", { name: "Clear" })).toHaveClass("w-full")
  })

  it("uses M3 error tokens", () => {
    render(
      <UtilityWorkbench
        title="Demo tool"
        description="Demo description"
        icon={<span>Icon</span>}
        input="bad input"
        output=""
        operation="convert"
        operations={[{ value: "convert", label: "Convert" }]}
        onInputChange={() => undefined}
        onOperationChange={() => undefined}
        onRun={() => undefined}
        onClear={() => undefined}
        error="Invalid input"
      />,
    )

    expect(screen.getByRole("alert")).toHaveClass(
      "bg-[var(--md-sys-color-error-container)]",
      "text-[var(--md-sys-color-on-error-container)]",
    )
  })

  it("shows a useful message when clipboard access fails", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    })

    render(
      <UtilityWorkbench
        title="Demo tool"
        description="Demo description"
        icon={<span>Icon</span>}
        input="input"
        output="result"
        operation="convert"
        operations={[{ value: "convert", label: "Convert" }]}
        onInputChange={() => undefined}
        onOperationChange={() => undefined}
        onRun={() => undefined}
        onClear={() => undefined}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: "Copy" }))
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Copy failed"))
  })
})

function Harness({ autoRun = false, onRunSpy = vi.fn(), operations = [{ value: "upper", label: "Upper" }, { value: "lower", label: "Lower" }] }: {
  autoRun?: boolean
  onRunSpy?: (input: string) => void
  operations?: Array<{ value: string; label: string }>
}) {
  const [input, setInput] = React.useState("")
  const [output, setOutput] = React.useState("")
  const [operation, setOperation] = React.useState(operations[0].value)
  return (
    <UtilityWorkbench
      title="Demo tool"
      description="Demo description"
      icon={<span>Icon</span>}
      input={input}
      output={output}
      operation={operation}
      operations={operations}
      onInputChange={setInput}
      onOperationChange={setOperation}
      onRun={() => { onRunSpy(input); setOutput(operation === "upper" ? input.toUpperCase() : input.toLowerCase()) }}
      onClear={() => { setInput(""); setOutput("") }}
      onSample={() => setInput("sample")}
      autoRun={autoRun}
      autoRunMaxChars={20}
    />
  )
}

describe("UtilityWorkbench run flow", () => {
  afterEach(() => { vi.useRealTimers() })

  it("runs with Ctrl/Cmd+Enter from the input", async () => {
    render(<Harness />)
    const [input, output] = screen.getAllByRole("textbox")
    fireEvent.change(input, { target: { value: "abc" } })
    fireEvent.keyDown(input, { key: "Enter", ctrlKey: true })
    await waitFor(() => expect(output).toHaveValue("ABC"))
    fireEvent.change(input, { target: { value: "xyz" } })
    fireEvent.keyDown(input, { key: "Enter", metaKey: true })
    await waitFor(() => expect(output).toHaveValue("XYZ"))
  })

  it("marks the output stale when the input changes and blocks copying it", async () => {
    render(<Harness />)
    const [input] = screen.getAllByRole("textbox")
    fireEvent.change(input, { target: { value: "abc" } })
    fireEvent.click(screen.getByRole("button", { name: "Run" }))
    await waitFor(() => expect(screen.getAllByRole("textbox")[1]).toHaveValue("ABC"))
    expect(screen.queryByText("staleOutput")).not.toBeInTheDocument()
    fireEvent.change(input, { target: { value: "abcd" } })
    expect(screen.getByText("staleOutput")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Copy" })).toBeDisabled()
  })

  it("runs the sample right after loading it", async () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole("button", { name: "Sample" }))
    await waitFor(() => expect(screen.getAllByRole("textbox")[1]).toHaveValue("SAMPLE"))
  })

  it("runs automatically after typing pauses and stops for long input", async () => {
    vi.useFakeTimers()
    const onRunSpy = vi.fn()
    render(<Harness autoRun onRunSpy={onRunSpy} />)
    const [input] = screen.getAllByRole("textbox")
    fireEvent.change(input, { target: { value: "ab" } })
    fireEvent.change(input, { target: { value: "abc" } })
    await act(async () => { await vi.advanceTimersByTimeAsync(350) })
    expect(onRunSpy).toHaveBeenCalledTimes(1)
    expect(onRunSpy).toHaveBeenLastCalledWith("abc")

    fireEvent.change(input, { target: { value: "x".repeat(21) } })
    await act(async () => { await vi.advanceTimersByTimeAsync(350) })
    expect(onRunSpy).toHaveBeenCalledTimes(1)
    expect(screen.getByText("autoRunPaused")).toBeInTheDocument()
  })

  it("hides the operation picker when there is only one operation", () => {
    render(<Harness operations={[{ value: "upper", label: "Upper" }]} />)
    expect(screen.queryByText("Operation")).not.toBeInTheDocument()
  })
})

describe("UtilityWorkbench replacing input", () => {
  afterEach(() => { toast.mockClear() })

  it("lets a cleared input be restored from the toast", () => {
    render(<Harness />)
    const [input] = screen.getAllByRole("textbox")
    fireEvent.change(input, { target: { value: "keep me" } })
    fireEvent.click(screen.getByRole("button", { name: "Clear" }))
    expect(input).toHaveValue("")
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "inputCleared" }))

    const action = toast.mock.calls.at(-1)![0].action as ReactElement<{ onClick: () => void }>
    act(() => { action.props.onClick() })
    expect(input).toHaveValue("keep me")
  })

  it("lets the input replaced by the sample be restored", () => {
    render(<Harness />)
    const [input] = screen.getAllByRole("textbox")
    fireEvent.change(input, { target: { value: "mine" } })
    fireEvent.click(screen.getByRole("button", { name: "Sample" }))
    expect(input).toHaveValue("sample")

    const action = toast.mock.calls.at(-1)![0].action as ReactElement<{ onClick: () => void }>
    expect(toast.mock.calls.at(-1)![0].title).toBe("inputReplacedBySample")
    act(() => { action.props.onClick() })
    expect(input).toHaveValue("mine")
  })

  it("stays quiet when there was nothing to lose", () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole("button", { name: "Clear" }))
    fireEvent.click(screen.getByRole("button", { name: "Sample" }))
    expect(toast).not.toHaveBeenCalled()
  })
})
