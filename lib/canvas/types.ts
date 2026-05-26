export type DataType = "string" | "number" | "json" | "bytes"

export interface PortDefinition {
  id: string
  name: string
  dataType: DataType
  required?: boolean
  defaultValue?: unknown
  jsonTypename?: string
}

export interface ConfigField {
  id: string
  name: string
  dataType: DataType
  defaultValue?: unknown
  options?: Array<{ label: string; value: string }>
}

export interface NodeDefinition {
  type: string
  category: "basic" | "crypto" | "image" | "text" | "dev" | "utility" | "viewer"
  label: string
  icon: React.ComponentType<{ className?: string }>
  inputs: PortDefinition[]
  outputs: PortDefinition[]
  config: ConfigField[]
  execute: (inputs: Record<string, unknown>, config: Record<string, unknown>) => Promise<Record<string, unknown>>
}

export interface NodeInstance {
  id: string
  type: string
  position: { x: number; y: number }
  config: Record<string, unknown>
}

export interface Edge {
  id: string
  source: string
  sourcePort: string
  target: string
  targetPort: string
}

export interface ValidationResult {
  valid: boolean
  level: "ok" | "warning" | "error"
  message?: string
}
