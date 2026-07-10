import type { NodeInstance } from "./types"

let fallbackSequence = 0

export function createCanvasNodeId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `node-${crypto.randomUUID()}`
  }

  fallbackSequence += 1
  return `node-${Date.now()}-${fallbackSequence}`
}

export function createCanvasNode(
  type: string,
  position: NodeInstance["position"]
): NodeInstance {
  return {
    id: createCanvasNodeId(),
    type,
    position,
    config: {},
  }
}
