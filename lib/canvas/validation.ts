import type { ConfigField, Edge, ValidationResult } from "./types"

const COMPATIBLE_TYPES: Record<string, string[]> = {
  string: ["string", "number"],
  number: ["string", "number"],
  json: ["json"],
  bytes: ["bytes"],
  boolean: ["boolean"],
}

export function validateConnection(
  source: ConfigField,
  target: ConfigField
): ValidationResult {
  const compatible = COMPATIBLE_TYPES[source.dataType]?.includes(target.dataType) ?? false

  if (compatible) {
    return { valid: true, level: "ok" }
  }

  return {
    valid: false,
    level: "error",
    message: `Incompatible types: ${source.dataType} → ${target.dataType}`,
  }
}

export function canAcceptInput(
  existingEdges: Edge[],
  sourcePortId: string,
  targetNodeId: string,
  targetPortId: string
): boolean {
  const hasExistingInput = existingEdges.some(
    (e) => e.target === targetNodeId && e.targetPort === targetPortId
  )
  if (hasExistingInput) return false

  return true
}
