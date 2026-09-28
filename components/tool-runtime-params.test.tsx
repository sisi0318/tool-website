import React from "react"
import { render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { readToolUrlParams, ToolRuntimeParamsProvider, useToolRuntimeParams } from "./tool-runtime-params"
import { WorkspaceProvider } from "./workspace-context"

function Show() {
  return <output>{JSON.stringify(useToolRuntimeParams() ?? null)}</output>
}

afterEach(() => window.history.replaceState(null, "", "/"))

describe("tool runtime params", () => {
  it("reads bare and tool-prefixed keys from a tool page URL, leaving op/input to the workbench", () => {
    expect(readToolUrlParams("?feature=format&json_domain=example.com&op=decode&input=x", "json")).toEqual({ feature: "format", domain: "example.com" })
    expect(readToolUrlParams("?op=decode", "json")).toBeUndefined()
  })

  it("uses the address bar on a standalone tool page", async () => {
    window.history.replaceState(null, "", "/tools/json?feature=minify")
    render(<Show />)
    expect(await screen.findByText('{"feature":"minify"}')).toBeInTheDocument()
  })

  it("uses only the tab parameters inside the workspace", async () => {
    window.history.replaceState(null, "", "/tools?tool=json&json_feature=format")
    render(<WorkspaceProvider value={{ openTool: vi.fn() }}><ToolRuntimeParamsProvider params={{ feature: "minify" }}><Show /></ToolRuntimeParamsProvider><Show /></WorkspaceProvider>)
    const outputs = screen.getAllByRole("status")
    expect(outputs.map((output) => output.textContent)).toEqual(['{"feature":"minify"}', "null"])
  })
})
