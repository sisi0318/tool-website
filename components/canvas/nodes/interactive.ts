/**
 * React Flow 只认这两个类:nodrag 让节点里的控件能正常拖选文字、拖动滑块,
 * 不会把整个节点拖走(还顺带写一条撤销记录);nowheel 让滚轮滚动内容区,而不是缩放画布。
 *
 * 在 React 的 onMouseDown 里 stopPropagation 拦不住它:d3-drag 在节点 DOM 上原生监听,
 * 比挂在根节点上的 React 事件更早触发。
 */
export const NODE_INTERACTIVE_CLASS = "nodrag nowheel"
