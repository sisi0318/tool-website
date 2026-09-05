import { describe, expect, it } from "vitest"
import { urlAdapter, registerUrlAdapter } from "./url"
import { suggestNext } from "../journey/suggest"

describe("URL adapter", () => {
  it("returns duplicate query records without flattening their values", async () => {
    const result = await urlAdapter.execute({ input: "https://example.com/?x=1&x=2&flag" }, {})
    expect(result.parameters).toEqual([{ name: "x", value: "1", hasEquals: true }, { name: "x", value: "2", hasEquals: true }, { name: "flag", value: "", hasEquals: false }])
  })
  it("applies component overrides and explicit query replacement", async () => {
    const result = await urlAdapter.execute({ input: "https://example.com/old?old=1" }, { overrides: '{"pathname":"/new","port":"8443"}', replaceQuery: true, parameters: '[{"name":"x","value":"a b"},{"name":"x","value":"c"}]' })
    expect(result.url).toBe("https://example.com:8443/new?x=a%20b&x=c")
    expect(result.components).toMatchObject({ hostname: "example.com", port: "8443", pathname: "/new" })
  })
  it("suggests URL inspection without requesting the target URL", () => {
    registerUrlAdapter()
    expect(suggestNext("https://example.com/?x=1", "string")[0]).toMatchObject({ tool: "url", outputPort: "components" })
  })
})
