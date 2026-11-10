import { getNodeDefinition } from "../canvas/registry"
import { withDefaultConfig } from "../canvas/node-factory"
import type { ConfigField } from "../canvas/types"
import { getMainInputPort } from "./engine"
import { STEP_LABEL_ENTRIES } from "./suggest"
import type { JourneyNode, JourneyStep } from "./types"

/**
 * 步骤列表里一步该怎么称呼。
 *
 * 以前轨迹上写的是工具名:“编码解码”。可同一个工具能做十几种事,不点开就不知道这一步
 * 是 Base64 解码还是 URL 编码。这里把步骤的配置对回建议矩阵里的动作短语;对不上的,
 * 用工具名加上最能说明问题的一两个选项。
 */
export interface StepDescription {
  /** journeySuggestions.<labelKey>;没有对上的短语时为 null,界面显示工具名 */
  labelKey: string | null
  /** 接在名字后面的选项文字(适配器里的原文),最多两个 */
  details: string[]
}

function optionsOf(field: ConfigField, config: Record<string, unknown>): Array<{ label: string; value: string }> {
  if (field.dependsOn && field.dynamicOptions) return field.dynamicOptions(String(config[field.dependsOn] ?? ""))
  return field.options ?? []
}

/** 用户能选的下拉字段:不含主输入,不含当前配置下隐藏的 */
function choiceFields(tool: string, config: Record<string, unknown>): ConfigField[] {
  const definition = getNodeDefinition(tool)
  if (!definition) return []
  const mainPortId = getMainInputPort(definition)?.id
  return definition.config.filter(
    (field) => field.id !== mainPortId && (!field.visible || field.visible(config)) && optionsOf(field, config).length > 0,
  )
}

export function describeStep(step: JourneyStep): StepDescription {
  const config = withDefaultConfig(step.tool, step.config)
  const defaults = withDefaultConfig(step.tool, {})
  const choices = choiceFields(step.tool, config)

  // 一条短语对得上,要求它写明的配置都相符,而且它没写明的下拉字段都停在默认值:
  // “格式化 XML”没写操作类型,靠的是默认值;换成 XPath 查询就不该再叫这个名字。
  let matched: { key: string; fields: number } | null = null
  for (const entry of STEP_LABEL_ENTRIES) {
    if (entry.tool !== step.tool) continue
    const fixed = entry.config ?? {}
    const fixedKeys = Object.keys(fixed)
    if (!fixedKeys.every((key) => String(config[key]) === String(fixed[key]))) continue
    if (!choices.every((field) => field.id in fixed || String(config[field.id]) === String(defaults[field.id]))) continue
    if (!matched || fixedKeys.length > matched.fields) matched = { key: entry.key, fields: fixedKeys.length }
  }
  if (matched) return { labelKey: matched.key, details: [] }

  // 没有现成的短语:工具名后面跟上偏离默认值的选项。有上下级的下拉(哈希的“分类 → 算法”)只留下级。
  const parents = new Set(choices.map((field) => field.dependsOn).filter((id): id is string => Boolean(id)))
  const details: string[] = []
  for (const field of choices) {
    if (parents.has(field.id) || String(config[field.id]) === String(defaults[field.id])) continue
    const option = optionsOf(field, config).find((candidate) => candidate.value === String(config[field.id]))
    if (option) details.push(option.label)
    if (details.length === 2) break
  }
  return { labelKey: null, details }
}

/** 一个数据状态的一行摘要,交给界面按当前语言写出来 */
export type ValueSummary =
  | { kind: "missing" }
  | { kind: "empty" }
  | { kind: "text"; chars: number; lines: number }
  | { kind: "file"; name: string; bytes: number }
  | { kind: "list"; items: number }
  | { kind: "object"; fields: number }
  | { kind: "scalar"; text: string }

export function summarizeValue(node: Pick<JourneyNode, "value" | "valueMissing">): ValueSummary {
  const { value } = node
  if (node.valueMissing) return { kind: "missing" }
  if (typeof value === "string") {
    if (value.length === 0) return { kind: "empty" }
    let lines = 1
    for (let index = value.indexOf("\n"); index !== -1; index = value.indexOf("\n", index + 1)) lines += 1
    return { kind: "text", chars: value.length, lines }
  }
  if (typeof Blob !== "undefined" && value instanceof Blob) {
    return { kind: "file", name: typeof File !== "undefined" && value instanceof File ? value.name : "", bytes: value.size }
  }
  if (Array.isArray(value)) return { kind: "list", items: value.length }
  if (value !== null && typeof value === "object") return { kind: "object", fields: Object.keys(value).length }
  if (value === null || value === undefined) return { kind: "empty" }
  return { kind: "scalar", text: String(value) }
}
