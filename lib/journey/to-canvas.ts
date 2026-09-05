import type { Edge, NodeInstance } from "../canvas/types"
import { getNodeDefinition } from "../canvas/registry"
import { encodeWorkflowData } from "../canvas/workflow"
import { writeLocalStorage } from "../safe-storage"
import { getMainInputPort, resolveOutputPort } from "./engine"
import { sanitizeConfig } from "./serialize"
import type { JourneyNode } from "./types"

const COLUMN_X = 120
const ROW_GAP = 170

interface CanvasWorkflow {
  nodes: NodeInstance[]
  edges: Edge[]
}

/** 根据根值类型选择画布源节点;文件类根需要用户在画布中重新选择文件 */
function sourceNodeFor(root: JourneyNode): NodeInstance {
  const base = { id: `journey-src`, position: { x: COLUMN_X, y: 40 } }
  switch (root.valueType) {
    case "number":
      return { ...base, type: "number", config: { value: typeof root.value === "number" ? root.value : 0 } }
    case "boolean":
      return { ...base, type: "boolean", config: { value: root.value === true } }
    case "bytes":
      return { ...base, type: "file", config: {} }
    case "json":
      return {
        ...base,
        type: "json",
        config: { value: safeStringify(root.value) },
      }
    default:
      return { ...base, type: "string", config: { value: typeof root.value === "string" ? root.value : "" } }
  }
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2) ?? "{}"
  } catch {
    return "{}"
  }
}

/** 源节点向下游供值的输出端口 */
function sourceOutputPort(type: string): string {
  if (type === "file") return "file"
  if (type === "json") return "parsed"
  return "value"
}

/**
 * 旅程路径(根→当前)→ 画布工作流。
 * 未注册的工具节点会被跳过并断链(返回的 skipped 供 UI 提示)。
 */
export function pathToWorkflow(path: JourneyNode[]): CanvasWorkflow & { skipped: string[] } {
  const nodes: NodeInstance[] = []
  const edges: Edge[] = []
  const skipped: string[] = []

  if (path.length === 0) return { nodes, edges, skipped }

  const source = sourceNodeFor(path[0])
  nodes.push(source)

  // null 表示上游已断:上一步的工具不可用,不能把它的上游直接接到下一步,
  // 否则被跳过的那次变换会被静默省略,数据语义整个变了。
  let previousId: string | null = source.id
  let previousPort = sourceOutputPort(source.type)
  let row = 1

  for (const node of path.slice(1)) {
    if (!node.via) continue
    const definition = getNodeDefinition(node.via.tool)
    const mainPort = definition ? getMainInputPort(definition) : null
    if (!definition || !mainPort) {
      skipped.push(node.via.tool)
      previousId = null
      continue
    }

    const instance: NodeInstance = {
      id: `journey-${row}`,
      type: node.via.tool,
      position: { x: COLUMN_X, y: 40 + row * ROW_GAP },
      config: sanitizeConfig(node.via.config),
    }
    nodes.push(instance)
    if (previousId !== null) {
      edges.push({
        id: `journey-e${row}`,
        source: previousId,
        sourcePort: previousPort,
        target: instance.id,
        targetPort: mainPort.id,
      })
    }

    previousId = instance.id
    // 分享链接里的 outputPort 可能为空,回退到该节点的首个输出端口。
    previousPort = resolveOutputPort(definition, node.via.outputPort)
    row += 1
  }

  return { nodes, edges, skipped }
}

/** 写入画布持久化槽位;随后由页面跳转 /canvas,canvas 挂载时自动加载 */
export function exportPathToCanvas(path: JourneyNode[]): { ok: boolean; skipped: string[] } {
  const { nodes, edges, skipped } = pathToWorkflow(path)
  if (nodes.length === 0) return { ok: false, skipped }
  const ok = writeLocalStorage("canvas-state", encodeWorkflowData({ nodes, edges }))
  return { ok, skipped }
}
