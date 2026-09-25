import React from "react"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import HTTPTester from "./page"

const mocks = vi.hoisted(() => ({ toast: vi.fn() }))
vi.mock("@/hooks/use-translations", () => { const translate = (key: string) => key; return { useTranslations: () => translate } })
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }))
vi.mock("@/components/json-tree-view", () => ({ JsonTreeView: () => null }))

const fetchMock = vi.fn()
beforeEach(() => {
  localStorage.clear()
  fetchMock.mockReset().mockResolvedValue({ text: async () => "AUDIT", headers: new Headers(), status: 200, statusText: "OK" })
  vi.stubGlobal("fetch", fetchMock)
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
const requestUrl = () => screen.getByRole("textbox", { name: "requestUrl" })
async function sendAndGetUrl() {
  const count = fetchMock.mock.calls.length
  fireEvent.click(screen.getByRole("button", { name: "submit" }))
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(count + 1))
  await waitFor(() => expect(screen.getByRole("button", { name: "submit" })).not.toBeDisabled())
  return (fetchMock.mock.calls[count][1].headers as Record<string, string>)["api-u"]
}

describe("HTTP request query editor", () => {
  it("does not transmit a disabled or removed last query row", async () => {
    render(<HTTPTester />)
    fireEvent.change(requestUrl(), { target: { value: "https://example.com/?token=synthetic#part" } })
    fireEvent.click(screen.getByRole("button", { name: "parseUrlParameters" }))
    fireEvent.click(screen.getByRole("checkbox", { name: "rowEnabled" }))
    expect(requestUrl()).toHaveValue("https://example.com/#part")
    expect(await sendAndGetUrl()).toBe("https://example.com/#part")
    fireEvent.click(screen.getByRole("checkbox", { name: "rowEnabled" }))
    fireEvent.click(screen.getByRole("button", { name: "removeParameter" }))
    expect(await sendAndGetUrl()).toBe("https://example.com/#part")
  })

  it("uses current URL query variables before and after parameter synchronization", async () => {
    render(<HTTPTester />)
    fireEvent.change(screen.getByRole("textbox", { name: "variableName" }), { target: { value: "token" } })
    fireEvent.change(screen.getByPlaceholderText("variableValue"), { target: { value: "a&b=c +d" } })
    fireEvent.change(requestUrl(), { target: { value: "https://example.com/?auth={{token}}" } })
    expect([...new URL(await sendAndGetUrl()).searchParams]).toEqual([["auth", "a&b=c +d"]])
    fireEvent.click(screen.getByRole("button", { name: "parseUrlParameters" }))
    expect([...new URL(await sendAndGetUrl()).searchParams]).toEqual([["auth", "a&b=c +d"]])
    fireEvent.change(requestUrl(), { target: { value: "https://example.com/other" } })
    expect(await sendAndGetUrl()).toBe("https://example.com/other")
  })
})

describe("cURL import errors", () => {
  it("explains which option could not be imported", async () => {
    render(<HTTPTester />)
    fireEvent.click(screen.getByRole("button", { name: /importCurl/ }))
    fireEvent.change(await screen.findByPlaceholderText(/curl -X POST/), { target: { value: "curl -x http://proxy:8080 https://example.com" } })
    fireEvent.click(screen.getByRole("button", { name: "import" }))
    expect(mocks.toast).toHaveBeenLastCalledWith(expect.objectContaining({ title: "curlParseFailed", description: "curlErrors.UNSUPPORTED_CURL_OPTION" }))
  })

  it("names an unclosed quote", async () => {
    render(<HTTPTester />)
    fireEvent.click(screen.getByRole("button", { name: /importCurl/ }))
    fireEvent.change(await screen.findByPlaceholderText(/curl -X POST/), { target: { value: "curl 'https://example.com" } })
    fireEvent.click(screen.getByRole("button", { name: "import" }))
    expect(mocks.toast).toHaveBeenLastCalledWith(expect.objectContaining({ description: "curlErrors.UNCLOSED_QUOTE" }))
  })
})
