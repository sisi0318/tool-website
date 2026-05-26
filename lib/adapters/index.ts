import { registerBasicNodes } from "./basic"
import { registerNode } from "../canvas/registry"
import type { ToolAdapter } from "./types"

export type { ToolAdapter }

export function registerAllAdapters(): void {
  registerBasicNodes()
}
