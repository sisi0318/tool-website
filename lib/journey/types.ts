import type { DataType } from "../canvas/types"

/** 一次变换(树的"边"):从父状态经某个工具与配置到达子状态 */
export interface JourneyStep {
  tool: string
  config: Record<string, unknown>
  outputPort: string
}

/** 一个数据状态(树的"节点") */
export interface JourneyNode {
  id: string
  parentId: string | null
  /** 从父节点到本节点经过的变换;根节点为 null */
  via: JourneyStep | null
  value: unknown
  valueType: DataType
  /** 展示名:工具 label 或输入来源名 */
  label: string
  createdAt: number
  /** 从存储恢复时值不可用(文件或超限),需从根重跑恢复 */
  valueMissing?: boolean
}

export interface Journey {
  version: 1
  name: string
  rootId: string
  activeId: string
  nodes: Record<string, JourneyNode>
}

export interface ApplyStepResult {
  outputs: Record<string, unknown>
  value: unknown
  valueType: DataType
}

export interface ReplayStepOutcome {
  step: JourneyStep
  status: "success" | "error"
  value?: unknown
  valueType?: DataType
  error?: string
  durationMs: number
}

export interface ReplayResult {
  outcomes: ReplayStepOutcome[]
  finalValue: unknown
  finalValueType: DataType
  ok: boolean
}

export interface ReplayDescendantFailure {
  nodeId: string
  tool: string
  error: string
}

/** Recomputed descendants keyed by their existing node ids. */
export interface ReplayDescendantsResult {
  nodeUpdates: Record<string, JourneyNode>
  failures: ReplayDescendantFailure[]
  ok: boolean
}

/** 建议:一键可应用的下一步 */
export interface JourneySuggestion {
  tool: string
  /** 展示标题(i18n key 之外的动态部分由 UI 处理;此处为英文工具语义短语) */
  label: string
  config: Record<string, unknown>
  outputPort?: string
  /** 来源:识别驱动(带识别类型)或类型兼容兜底 */
  reason: "detection" | "compatible"
  detectionType?: string
  score: number
}

/** 可通过 URL 分享的路径描述(不含数据本体,除非显式携带小文本) */
export interface SharedJourneyPath {
  v: 1
  name: string
  steps: JourneyStep[]
  rootText?: string
}
