import type { NodeDefinition } from "./types"

const nodeRegistry = new Map<string, NodeDefinition>()

export function registerNode(definition: NodeDefinition): void {
  nodeRegistry.set(definition.type, definition)
}

export function getNodeDefinition(type: string): NodeDefinition | undefined {
  return nodeRegistry.get(type)
}

export function getAllNodes(): NodeDefinition[] {
  return Array.from(nodeRegistry.values())
}

export function getNodesByCategory(category: string): NodeDefinition[] {
  return Array.from(nodeRegistry.values()).filter((def) => def.category === category)
}

export function getRegisteredTypes(): string[] {
  return Array.from(nodeRegistry.keys())
}

export function isRegistered(type: string): boolean {
  return nodeRegistry.has(type)
}

export function unregisterNode(type: string): boolean {
  return nodeRegistry.delete(type)
}

export function clearRegistry(): void {
  nodeRegistry.clear()
}
