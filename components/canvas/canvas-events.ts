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
 * 点了节点上的一个端口：请画布打开能接到这个端口上的节点列表。
 * 端口画在节点卡片里，列表和新节点的落点在画布组件手里。
 */
export const PORT_PICKER_EVENT = "canvas:port-picker"

export interface PortPickerRequest {
  nodeId: string
  portId: string
  /** source：输出端口，往后接；target：输入端口，往前接 */
  side: "source" | "target"
  /** 列表贴着哪儿弹出（屏幕坐标） */
  anchor: { x: number; y: number }
}

export function requestPortPicker(request: PortPickerRequest) {
  window.dispatchEvent(new CustomEvent<PortPickerRequest>(PORT_PICKER_EVENT, { detail: request }))
}
