import React from "react"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import RegexTester from "./page"
import { RegexTimeoutError, type RegexRunOptions, type RegexRunResult } from "@/lib/regex-runner"

interface Run { options: RegexRunOptions; resolve: (result: RegexRunResult) => void; reject: (error: Error) => void }
const runs = vi.hoisted(() => [] as Run[])
const download = vi.hoisted(() => vi.fn())

// 执行交给测试控制：可以让旧的一次比新的一次更晚返回
vi.mock("@/lib/regex-runner", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/regex-runner")>()),
  runRegex: (options: RegexRunOptions) => new Promise<RegexRunResult>((resolve, reject) => { runs.push({ options, resolve, reject }) }),
}))
vi.mock("@/lib/object-url", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/object-url")>()), downloadBlob: download }))
vi.mock("@/hooks/use-translations", () => { const translate = (key: string) => key; return { useTranslations: () => translate } })
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }))

const found = (index: number, text: string) => ({ index, match: text, groups: [], length: text.length })
const testRuns = () => runs.filter((run) => run.options.replacement === undefined)

function enter(pattern: string, text?: string) {
  if (text !== undefined) fireEvent.change(screen.getByPlaceholderText("testStringPlaceholder"), { target: { value: text } })
  fireEvent.change(screen.getByPlaceholderText("patternPlaceholder"), { target: { value: pattern } })
}

beforeEach(() => {
  runs.length = 0
  download.mockClear()
  window.localStorage.clear()
})

describe("regex tester", () => {
  it("keeps the matches found before the cap and ignores a late timeout from an older pattern", async () => {
    render(<RegexTester />)
    enter("(a+)+$", "aaa!")
    await waitFor(() => expect(testRuns()).toHaveLength(1))
    enter("a")
    await waitFor(() => expect(testRuns()).toHaveLength(2))

    await act(async () => testRuns()[1].resolve({ matches: [found(0, "a"), found(1, "a")], hitIterationLimit: true, durationMs: 1 }))
    await act(async () => testRuns()[0].reject(new RegexTimeoutError(2000)))

    expect(screen.getByText("matchLimitReached")).toBeInTheDocument()
    expect(screen.queryByText("regexTimeout")).not.toBeInTheDocument()
    expect(screen.getAllByText(/^#\d+$/)).toHaveLength(2)
  })

  it("exports the matches and lets the replace tab change the flags", async () => {
    render(<RegexTester />)
    enter("b", "abcb")
    await waitFor(() => expect(testRuns()).toHaveLength(1))
    await act(async () => testRuns()[0].resolve({ matches: [found(1, "b"), found(3, "b")], hitIterationLimit: false, durationMs: 1 }))

    fireEvent.click(screen.getByRole("button", { name: "exportMatches" }))
    expect(download).toHaveBeenCalledWith(expect.any(Blob), "regex-matches.json")

    fireEvent.mouseDown(screen.getByRole("tab", { name: /tabs\.replace/ }))
    fireEvent.click(screen.getByRole("switch", { name: /caseInsensitive/ }))
    await waitFor(() => expect(runs.some((run) => run.options.replacement !== undefined && run.options.flags.includes("i"))).toBe(true))
  })
})
