import type { PortDefinition, Edge, ValidationResult } from "./types"
import { validateJsonConnection } from "./types/json-meta"

const COMPATIBLE_TYPES: Record<string, string[]> = {
  string: ["string", "number"],
  number: ["string", "number"],
  json: ["json"],
  bytes: ["bytes"],
}

export function validateConnection(
  source: PortDefinition,
  target: PortDefinition
): ValidationResult {
  if (source.dataType === "json" && target.dataType === "json") {
    return validateJsonConnection(source.jsonTypename, target.jsonTypename)
  }

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
  sourcePort: PortDefinition,
  targetPort: PortDefinition
): boolean {
  const hasExistingInput = existingEdges.some((e) => e.targetPort === targetPort.id)
  if (hasExistingInput) return false

  const result = validateConnection(sourcePort, targetPort)
  return result.valid
}
