export type DataType = "string" | "number" | "json" | "bytes" | "boolean"

export interface SliderConfig {
  min: number
  max: number
  step: number
}

export interface ConfigField {
  id: string
  name: string
  dataType: DataType
  defaultValue?: unknown
  options?: Array<{ label: string; value: string }>
  slider?: SliderConfig
  multiline?: boolean
  color?: boolean
  dependsOn?: string
  dynamicOptions?: (dependentValue: string) => Array<{ label: string; value: string }>
  visible?: (config: Record<string, unknown>) => boolean
  hasInput?: boolean   // Whether this parameter has an input port on the left
  hasOutput?: boolean  // Whether this parameter has an output port on the right
}

export interface DerivedOutput {
  id: string
  name: string
  dataType: DataType
}

export interface NodeDefinition {
  type: string
  category: "basic" | "crypto" | "image" | "text" | "dev" | "utility" | "viewer"
  label: string
  icon: React.ComponentType<{ className?: string }>
  config: ConfigField[]
  outputs: DerivedOutput[]   // Computed outputs (like Hash result)
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
