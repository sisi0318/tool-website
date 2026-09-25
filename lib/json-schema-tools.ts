import Ajv, { type ErrorObject, type ValidateFunction } from "ajv"
import addFormats from "ajv-formats"
import { jsonErrorLocation, LocatedError, type TextLocation } from "@/lib/text-location"

export type JsonSchemaOperation = "validate" | "infer"
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }
export type JsonSchema = Record<string, unknown>

export interface JsonSchemaValidationResult {
  valid: boolean
  errors: Array<{ path: string; message: string; keyword: string; params: Record<string, unknown> }>
}

const ajv = new Ajv({ allErrors: true, strict: false, allowUnionTypes: true })
addFormats(ajv, { mode: "fast" })
const validatorCache = new Map<string, ValidateFunction>()
const MAX_VALIDATOR_CACHE_SIZE = 50

/** 数据或 schema 不是合法 JSON、或 schema 本身无效；field 指明是哪个输入框 */
export class JsonSchemaInputError extends LocatedError {
  constructor(readonly field: "data" | "schema", message: string, location: TextLocation | null = null) {
    super(message, location)
    this.name = "JsonSchemaInputError"
  }
}

function parseJson(value: unknown, field: "data" | "schema"): unknown {
  if (typeof value !== "string") return value
  try {
    return JSON.parse(value)
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Invalid JSON"
    throw new JsonSchemaInputError(field, `${field === "data" ? "Data" : "Schema"}: ${message}`, jsonErrorLocation(value, cause))
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
  const data = parseJson(dataInput, "data")
  const schema = parseJson(schemaInput, "schema") as object
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) throw new JsonSchemaInputError("schema", "Schema must be a JSON object")

  const key = schemaKey(schema as JsonSchema)
  let validate = validatorCache.get(key)
  if (!validate) {
    try {
      validate = ajv.compile(schema)
    } catch (cause) {
      throw new JsonSchemaInputError("schema", `Schema: ${cause instanceof Error ? cause.message : "invalid schema"}`)
    }
    if (validatorCache.size >= MAX_VALIDATOR_CACHE_SIZE) {
      const oldestKey = validatorCache.keys().next().value
      if (oldestKey) validatorCache.delete(oldestKey)
    }
    validatorCache.set(key, validate)
  }
  const valid = Boolean(validate(data))
  return { valid, errors: normalizeErrors(validate.errors) }
}

export function processJsonSchema(dataInput: unknown, operation: JsonSchemaOperation, schemaInput?: unknown) {
  if (operation === "infer") {
    const data = parseJson(dataInput, "data") as JsonValue
    return { valid: true, schema: inferJsonSchema(data), errors: [] as JsonSchemaValidationResult["errors"] }
  }
  const validation = validateJsonSchema(dataInput, schemaInput)
  return { ...validation, schema: null }
}
