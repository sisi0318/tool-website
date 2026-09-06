import { beforeAll, describe, expect, it, vi } from "vitest"
import { registerAllAdapters } from "../adapters"
import { getNodeDefinition, registerNode } from "../canvas/registry"
import { isTypeCompatible } from "../canvas/validation"
import { getMainInputPort, replaySteps } from "./engine"
import { reviewSharedPath } from "./serialize"
import { getJourneyTemplate, JOURNEY_TEMPLATES, journeyTemplatePath, templateIdFromHash } from "./templates"
const blobText = (blob: Blob): Promise<string> => new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.readAsText(blob) })
beforeAll(registerAllAdapters)
describe("curated workflow templates", () => {
  it("uses registered local tools, compatible ports and independent configuration copies", () => {
    expect(new Set(JOURNEY_TEMPLATES.map(template => template.id)).size).toBe(6)
    for (const template of JOURNEY_TEMPLATES) {
      const path = journeyTemplatePath(template, template.id)
      expect(reviewSharedPath(path).blocked).toBe(false)
      let type = template.input === "image" ? "bytes" as const : "string" as const
      for (const step of path.steps) {
        const definition = getNodeDefinition(step.tool)!, input = getMainInputPort(definition)!, output = definition.outputs.find(port => port.id === step.outputPort)!
        expect(input).toBeDefined(); expect(output).toBeDefined(); expect(isTypeCompatible(type, input.dataType)).toBe(true)
        type = output.dataType as typeof type
      }
      expect(type).toBe("bytes"); path.steps[0].config.changed = true; expect(template.steps[0].config.changed).toBeUndefined()
    }
    expect(templateIdFromHash("#template=scan-text")).toBe("scan-text"); expect(templateIdFromHash("#template=not-a-template")).toBeNull()
  })
  it("executes every text template through the real adapters and produces the promised file", async () => {
    const expected: Record<string, string> = { "clean-list": "clean-list.txt", "csv-json": "records.json", "base64-json": "decoded.json", "json-yaml": "config.yaml" }
    for (const template of JOURNEY_TEMPLATES.filter(value => value.input === "text")) {
      const result = await replaySteps(template.sampleText, template.steps)
      expect(result.ok, template.id).toBe(true); expect(result.outcomes).toHaveLength(template.steps.length)
      const file = result.finalValue as File; expect(file.name).toBe(expected[template.id]); const text = await blobText(file)
      if (template.id === "clean-list") expect(text).toBe("café\napple\n橙子")
      if (template.id === "csv-json") expect(JSON.parse(text)).toEqual([{ 编号: "00123", 名称: "键盘", 数量: "12" }, { 编号: "00456", 名称: "鼠标", 数量: "8" }])
      if (template.id === "base64-json") expect(JSON.parse(text)).toEqual({ name: "Ada", roles: ["dev", "admin"] })
      if (template.id === "json-yaml") expect((await import("js-yaml")).load(text)).toEqual(JSON.parse(template.sampleText!))
    }
  })
  it("stops on invalid decoded JSON and retains the successful decoded prefix", async () => {
    const template = getJourneyTemplate("base64-json")!, result = await replaySteps("bm90LWpzb24=", template.steps)
    expect(result.ok).toBe(false); expect(result.finalValue).toBe("not-json"); expect(result.outcomes.map(value => value.status)).toEqual(["success", "error"])
  })
  it("aborts the current adapter, retains completed steps and never starts later steps", async () => {
    let captured: AbortSignal | undefined, finish!: (value: Record<string, unknown>) => void
    const tail = vi.fn(async () => ({ output: "unexpected" }))
    registerNode({ type: "template-wait", label: "Wait", icon: getNodeDefinition("encoding")!.icon, category: "data", config: [{ id: "input", name: "Input", dataType: "string", hasInput: true }], outputs: [{ id: "output", name: "Output", dataType: "string" }], execute: (_inputs, _config, context) => { captured = context?.signal; return new Promise(resolve => { finish = resolve }) } })
    registerNode({ type: "template-tail", label: "Tail", icon: getNodeDefinition("encoding")!.icon, category: "data", config: [{ id: "input", name: "Input", dataType: "string", hasInput: true }], outputs: [{ id: "output", name: "Output", dataType: "string" }], execute: tail })
    const controller = new AbortController(), progress = vi.fn(), promise = replaySteps(" aGVsbG8= ", [{ tool: "encoding", config: { mode: "decode", encoding: "base64" }, outputPort: "output" }, { tool: "template-wait", config: {}, outputPort: "output" }, { tool: "template-tail", config: {}, outputPort: "output" }], { signal: controller.signal, onStep: progress })
    await vi.waitFor(() => expect(captured).toBeDefined()); controller.abort(); const result = await promise
    expect(captured!.aborted).toBe(true); expect(result.finalValue).toBe("hello"); expect(result.outcomes.map(value => value.status)).toEqual(["success", "error"]); expect(tail).not.toHaveBeenCalled(); expect(progress).toHaveBeenCalledTimes(2)
    finish({ output: "late" }); await Promise.resolve(); expect(result.finalValue).toBe("hello")
  })
})
