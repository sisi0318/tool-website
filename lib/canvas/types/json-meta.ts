import type { PortDefinition, ValidationResult } from "../types"

export interface JsonMeta {
  typename?: string
  schema?: Record<string, unknown>
}

export function createJsonPort(id: string, name: string, typename?: string): PortDefinition {
  return {
    id,
    name,
    dataType: "json",
    jsonTypename: typename,
  }
}

export function validateJsonTypename(
  sourceTypename: string | undefined,
  targetTypename: string | undefined
): "match" | "mismatch" | "compatible" {
  if (!sourceTypename || !targetTypename) return "compatible"
  if (sourceTypename === targetTypename) return "match"
  return "mismatch"
}

export function validateJsonConnection(
  sourceTypename: string | undefined,
  targetTypename: string | undefined
): ValidationResult {
  const result = validateJsonTypename(sourceTypename, targetTypename)

  if (result === "match") {
    return { valid: true, level: "ok" }
  }

  if (result === "compatible") {
    return { valid: true, level: "ok" }
  }

  return {
    valid: true,
    level: "warning",
    message: `JSON typename mismatch: ${sourceTypename} → ${targetTypename}`,
  }
}
