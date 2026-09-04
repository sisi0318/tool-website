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
  /**
   * 长期凭据(TOTP 种子、Authorization 头等),跨信任边界(分享链接)时剥离。
   * 加解密的 key/iv、HMAC key 不属此类:它们是复现这一步所必需的配方参数,照常分享。
   */
  sensitive?: boolean
}

export interface DerivedOutput {
  id: string
  name: string
  dataType: DataType
}

export interface PortDefinition extends DerivedOutput {
  jsonTypename?: string
}

export interface NodeDefinition {
  type: string
  category: "basic" | "crypto" | "data" | "image" | "text" | "dev" | "utility" | "viewer"
  label: string
  description?: string
  executionMode?: "automatic" | "manual"
  /**
   * 执行时会发出网络请求。此类节点不允许出现在导入的分享路径里,
   * 避免打开链接即向外部发起请求(或把粘贴的数据带出去)。
   */
  network?: boolean
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
  /** Skip the node implementation and forward compatible upstream values. */
  disabled?: boolean
}

export interface Edge {
  id: string
  source: string
  sourcePort: string
  target: string
  targetPort: string
}

export type ExecutionLogStatus = "running" | "success" | "error" | "cancelled" | "skipped"

export interface ExecutionStepProgress {
  current: number
  total: number
  nextNodeId: string | null
}

export interface ExecutionLogEntry {
  id: number
  nodeId: string
  nodeType: string
  status: ExecutionLogStatus
  startedAt: number
  durationMs: number
  error?: string
}

export interface ValidationResult {
  valid: boolean
  level: "ok" | "warning" | "error"
  message?: string
}
