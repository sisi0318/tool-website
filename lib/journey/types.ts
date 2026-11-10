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
  /** 选中的节点:详情显示它,下一步也接在它后面 */
  activeId: string
  /**
   * 当前这条路的末端。只在“回头看前面的步骤”时才写:此时 activeId 停在路中间,
   * 靠它记住后面还有哪些步骤,界面上才不会一回头就把后半条路藏起来。
   * 选中的就是末端时不写,所以大多数旅程存下来的样子和加这个字段之前一样。
   * 读的时候一律走 getTipId:它会校验这个值,失效时按最近走过的分支推出来。
   */
  tipId?: string
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
  /** 英文原文；界面按 labelKey 显示当前语言，兜底建议没有 labelKey，按工具名显示 */
  label: string
  /** journeySuggestions.<labelKey> */
  labelKey?: string
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
