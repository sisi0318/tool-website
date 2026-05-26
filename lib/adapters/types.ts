import type { NodeDefinition } from "../canvas/types"

export interface ToolAdapter extends NodeDefinition {
  type: string
  category: "basic" | "crypto" | "image" | "text" | "dev" | "utility" | "viewer"
}
