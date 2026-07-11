import React from "react"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { UtilityWorkbench } from "./utility-workbench"

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
    inputPlaceholder: "Input placeholder",
    outputPlaceholder: "Output placeholder",
  }[key] ?? key),
}))

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
})
