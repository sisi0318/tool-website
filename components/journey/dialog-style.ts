/**
 * 旅程弹层的统一外观:桌面上是居中对话框,手机上贴底展开成抽屉。
 *
 * 只用 max-sm: 变体覆盖 DialogContent 的定位、圆角与入场动画,不引入第二套弹层组件,
 * 焦点圈禁、Escape 关闭、aria 语义仍由 Radix Dialog 提供。
 */
export const SHEET_ON_MOBILE = [
  "max-sm:inset-x-0 max-sm:bottom-0 max-sm:top-auto max-sm:left-0",
  "max-sm:w-full max-sm:max-w-none max-sm:max-h-[90vh] max-sm:overflow-y-auto",
  "max-sm:translate-x-0 max-sm:translate-y-0",
  "max-sm:rounded-b-none max-sm:rounded-t-3xl max-sm:border-x-0 max-sm:border-b-0",
  "max-sm:pb-[max(1.5rem,env(safe-area-inset-bottom))]",
  "max-sm:data-[state=open]:slide-in-from-bottom max-sm:data-[state=open]:slide-in-from-left-0 max-sm:data-[state=open]:slide-in-from-top-0 max-sm:data-[state=open]:zoom-in-100",
  "max-sm:data-[state=closed]:slide-out-to-bottom max-sm:data-[state=closed]:slide-out-to-left-0 max-sm:data-[state=closed]:slide-out-to-top-0 max-sm:data-[state=closed]:zoom-out-100",
].join(" ")

export const JOURNEY_DIALOG_CLASS = `rounded-3xl border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-low)] ${SHEET_ON_MOBILE}`
