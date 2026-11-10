/**
 * 换了一整张图（读取、导入工作流）之后请画布把内容收进视野。
 * 发请求的在菜单里，镜头在画布组件手里，中间隔着一层，所以走事件；
 * 保存用的 SAVE_WORKFLOW_EVENT 是同一个做法。
 */
export const FIT_CANVAS_EVENT = "canvas:fit-view"

export function requestCanvasFit() {
  window.dispatchEvent(new Event(FIT_CANVAS_EVENT))
}

/**
 * 点了节点右侧的“+”：请画布打开“接在它后面”的节点列表。
 * “+”画在节点卡片里（它要跟着节点的高度和鼠标走），列表和落点在画布组件手里。
 */
export const APPEND_NODE_EVENT = "canvas:append-node"

export interface AppendNodeRequest {
  nodeId: string
  /** 列表贴着哪儿弹出（屏幕坐标） */
  anchor: { x: number; y: number }
}

export function requestAppendNode(nodeId: string, anchor: { x: number; y: number }) {
  window.dispatchEvent(new CustomEvent<AppendNodeRequest>(APPEND_NODE_EVENT, { detail: { nodeId, anchor } }))
}
