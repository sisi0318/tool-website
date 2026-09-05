import { Link2 } from "lucide-react"
import { registerNode } from "../canvas/registry"
import type { ToolAdapter } from "./types"
import type { UrlParts } from "../url-tools"

export const urlAdapter: ToolAdapter = {
  type: "url", category: "text", label: "URL Editor", icon: Link2,
  description: "Parse and rebuild URLs while retaining duplicate query parameters and raw encodings",
  config: [
    { id: "input", name: "URL", dataType: "string", defaultValue: "", hasInput: true },
    { id: "base", name: "Base URL for relative input", dataType: "string", defaultValue: "" },
    { id: "plusAsSpace", name: "Decode + as space", dataType: "boolean", defaultValue: true },
    { id: "preserveEncoding", name: "Preserve unchanged parameter encodings", dataType: "boolean", defaultValue: true },
    { id: "spaceEncoding", name: "Encode spaces", dataType: "string", defaultValue: "percent", options: [{ label: "%20", value: "percent" }, { label: "+", value: "plus" }] },
    { id: "overrides", name: "Component overrides (protocol, hostname, port, pathname, fragment, username, password)", dataType: "json", defaultValue: {} },
    { id: "replaceQuery", name: "Replace query parameters", dataType: "boolean", defaultValue: false },
    { id: "parameters", name: 'Ordered parameters: [{"name":"tag","value":"a"},{"name":"tag","value":"b"}]', dataType: "json", defaultValue: [], visible: (config) => config.replaceQuery === true },
  ],
  outputs: [{ id: "url", name: "URL", dataType: "string" }, { id: "components", name: "Components", dataType: "json" }, { id: "parameters", name: "Query parameters", dataType: "json" }],
  async execute(inputs, config) {
    const { inspectUrl, buildUrl, replaceUrlParameters, UrlToolError } = await import("../url-tools")
    const inspected = inspectUrl(String(inputs.input ?? config.input ?? ""), { base: String(config.base ?? ""), plusAsSpace: config.plusAsSpace !== false })
    let parts = inspected.parts
    const overrides: unknown = typeof config.overrides === "string" ? JSON.parse(config.overrides) : config.overrides ?? {}
    if (!overrides || typeof overrides !== "object" || Array.isArray(overrides)) throw new UrlToolError("invalidUrl")
    const allowed = ["protocol", "hostname", "port", "pathname", "fragment", "username", "password"]
    for (const [key, value] of Object.entries(overrides)) { if (!allowed.includes(key) || typeof value !== "string") throw new UrlToolError("invalidUrl"); parts = { ...parts, [key]: value } as UrlParts }
    if (config.replaceQuery === true) parts = replaceUrlParameters(parts, typeof config.parameters === "string" ? JSON.parse(config.parameters) : config.parameters ?? [])
    const url = buildUrl(parts, { preserveEncoding: config.preserveEncoding !== false, spaceEncoding: String(config.spaceEncoding ?? "percent") as "percent" | "plus" })
    const output = inspectUrl(url, { plusAsSpace: config.spaceEncoding === "plus" || config.plusAsSpace !== false })
    const { parameters, ...components } = output.parts
    return { url, components: { ...components, origin: output.origin, unicodeHostname: output.unicodeHostname, decodedPath: output.decodedPath, decodedFragment: output.decodedFragment, issues: output.issues }, parameters: parameters.map(({ name, value, hasEquals }) => ({ name, value, hasEquals })) }
  },
}
export function registerUrlAdapter(): void { registerNode(urlAdapter) }
