import { Braces } from "lucide-react"

import { registerNode } from "../canvas/registry"
import { processJsonSchema, type JsonSchemaOperation } from "../json-schema-tools"
import type { ToolAdapter } from "./types"

export const jsonSchemaAdapter: ToolAdapter = {
  type: "json-schema",
  category: "data",
  label: "JSON Schema",
  description: "Validate JSON against a schema or infer a schema from sample data",
  icon: Braces,
  config: [
    { id: "data", name: "JSON data", dataType: "json", defaultValue: {}, multiline: true, hasInput: true },
    { id: "operation", name: "Operation", dataType: "string", defaultValue: "validate", options: [
      { label: "Validate", value: "validate" }, { label: "Infer schema", value: "infer" },
    ], hasInput: true },
    { id: "schema", name: "JSON Schema", dataType: "json", defaultValue: {}, multiline: true, hasInput: true },
  ],
  outputs: [
    { id: "valid", name: "Valid", dataType: "boolean" },
    { id: "schema", name: "Inferred schema", dataType: "json" },
    { id: "errors", name: "Errors", dataType: "json" },
    { id: "output", name: "Result", dataType: "string" },
  ],
  async execute(inputs, config) {
    const result = processJsonSchema(
      inputs.data ?? config.data ?? {},
      String(inputs.operation ?? config.operation ?? "validate") as JsonSchemaOperation,
      inputs.schema ?? config.schema ?? {}
    )
    return { ...result, output: JSON.stringify(result.schema ?? result.errors, null, 2) }
  },
}

export function registerJsonSchemaAdapter(): void {
  registerNode(jsonSchemaAdapter)
}
