// @vitest-environment node
import { describe, expect, it } from "vitest"
import { tabularAdapter, tabularFileAdapter, registerTabularAdapters } from "./tabular"
import { suggestNext } from "../journey/suggest"

describe("tabular adapters", () => {
  it("shares filtered grouping and returns bad-line diagnostics", async () => {
    const result = await tabularAdapter.execute({ input: '{"status":500,"service":"api"}\n{bad}\n{"status":200,"service":"web"}\n{"status":502,"service":"api"}' }, { filters: '[{"column":"status","operator":"gte","value":"500"}]', groupBy: '["service"]', outputFormat: "jsonl" })
    expect(result.rows).toEqual([{ service: "api", count: 2 }]); expect(result.lines).toEqual([1]); expect(result.errorCount).toBe(1); expect(result.output).toBe('{"service":"api","count":2}')
  })
  it("reads bytes as a file and preserves CSV strings", async () => {
    const result = await tabularFileAdapter.execute({ input: new File(["id,status\n001,500"], "log.csv") }, {})
    expect(result.rows).toEqual([{ id: "001", status: "500" }])
  })
  it("suggests log and tabular file processing with executable defaults", () => {
    registerTabularAdapters()
    expect(suggestNext('{"a":1}\n{"a":2}', "string")[0]).toMatchObject({ tool: "tabular", config: { format: "jsonl" }, outputPort: "rows" })
    expect(suggestNext(new File(["a,b\n1,2"], "log.csv"), "bytes")[0]).toMatchObject({ tool: "tabular-file", config: { format: "csv" } })
  })
})
