import Ajv, { type ErrorObject } from "ajv"
import addFormats from "ajv-formats"

export type JsonSchemaOperation = "validate" | "infer"
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }
export type JsonSchema = Record<string, unknown>

export interface JsonSchemaValidationResult {
  valid: boolean
  errors: Array<{ path: string; message: string; keyword: string; params: Record<string, unknown> }>
}

function parseJson(value: unknown, label: string): unknown {
  if (typeof value !== "string") return value
  try {
    return JSON.parse(value)
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Invalid JSON"
    throw new Error(`${label}: ${message}`)
  }
}

function inferStringFormat(value: string): Pick<JsonSchema, "format"> | Record<string, never> {
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return { format: "date-time" }
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return { format: "email" }
  if (/^https?:\/\/\S+$/.test(value)) return { format: "uri" }
  return {}
}

function stableJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableJson)
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, stableJson(child)])
    )
  }
  return value
}

function schemaKey(schema: JsonSchema): string {
  return JSON.stringify(stableJson(schema))
}

export function inferJsonSchema(value: JsonValue): JsonSchema {
  if (value === null) return { type: "null" }
  if (Array.isArray(value)) {
    if (value.length === 0) return { type: "array", items: {} }
    const candidates = value.map(inferJsonSchema)
    const unique = [...new Map(candidates.map((schema) => [schemaKey(schema), schema])).values()]
    return { type: "array", items: unique.length === 1 ? unique[0] : { anyOf: unique } }
  }
  if (typeof value === "object") {
    const entries = Object.entries(value)
    return {
      type: "object",
      properties: Object.fromEntries(entries.map(([key, child]) => [key, inferJsonSchema(child)])),
      required: entries.map(([key]) => key),
      additionalProperties: false,
    }
  }
  if (typeof value === "string") return { type: "string", ...inferStringFormat(value) }
  if (typeof value === "number") return { type: Number.isInteger(value) ? "integer" : "number" }
  return { type: "boolean" }
}

function normalizeErrors(errors: ErrorObject[] | null | undefined): JsonSchemaValidationResult["errors"] {
  return (errors ?? []).map((error) => ({
    path: error.instancePath || "/",
    message: error.message ?? "Validation failed",
    keyword: error.keyword,
    params: error.params as Record<string, unknown>,
  }))
}

export function validateJsonSchema(dataInput: unknown, schemaInput: unknown): JsonSchemaValidationResult {
  const data = parseJson(dataInput, "Data")
  const schema = parseJson(schemaInput, "Schema") as object
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) throw new Error("Schema must be a JSON object")

  const ajv = new Ajv({ allErrors: true, strict: false, allowUnionTypes: true })
  addFormats(ajv, { mode: "fast" })
  const validate = ajv.compile(schema)
  const valid = Boolean(validate(data))
  return { valid, errors: normalizeErrors(validate.errors) }
}

export function processJsonSchema(dataInput: unknown, operation: JsonSchemaOperation, schemaInput?: unknown) {
  if (operation === "infer") {
    const data = parseJson(dataInput, "Data") as JsonValue
    return { valid: true, schema: inferJsonSchema(data), errors: [] as JsonSchemaValidationResult["errors"] }
  }
  const validation = validateJsonSchema(dataInput, schemaInput)
  return { ...validation, schema: null }
}
