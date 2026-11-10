/**
 * 换了一整张图（读取、导入工作流）之后请画布把内容收进视野。
 * 发请求的在菜单里，镜头在画布组件手里，中间隔着一层，所以走事件；
 * 保存用的 SAVE_WORKFLOW_EVENT 是同一个做法。
 */
export const FIT_CANVAS_EVENT = "canvas:fit-view"

export function requestCanvasFit() {
  window.dispatchEvent(new Event(FIT_CANVAS_EVENT))
}
