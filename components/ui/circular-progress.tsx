import * as React from "react"

import { cn } from "@/lib/utils"

export interface CircularProgressProps extends Omit<React.SVGAttributes<SVGSVGElement>, "children"> {
  /** 0 到 max 之间的当前值 */
  value: number
  max?: number
  /** 直径,像素 */
  size?: number
  strokeWidth?: number
}

const RADIUS = 18
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/**
 * 环形进度(只做确定态;转圈等待请用 Loader 图标)。
 * 从 12 点方向顺时针填充,颜色走 M3 令牌。
 */
const CircularProgress = React.forwardRef<SVGSVGElement, CircularProgressProps>(
  ({ value, max = 100, size = 40, strokeWidth = 4, className, ...props }, ref) => {
    const clamped = Math.min(Math.max(0, value), max)
    const offset = CIRCUMFERENCE - (clamped / max) * CIRCUMFERENCE

    return (
      <svg
        ref={ref}
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={max}
        viewBox="0 0 44 44"
        width={size}
        height={size}
        className={cn("inline-block -rotate-90", className)}
        {...props}
      >
        <circle
          cx="22"
          cy="22"
          r={RADIUS}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-[var(--md-sys-color-surface-container-highest)]"
        />
        <circle
          cx="22"
          cy="22"
          r={RADIUS}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          className="stroke-[var(--md-sys-color-primary)] transition-[stroke-dashoffset] duration-300 ease-linear"
          style={{ strokeDasharray: CIRCUMFERENCE, strokeDashoffset: offset }}
        />
      </svg>
    )
  },
)
CircularProgress.displayName = "CircularProgress"

export { CircularProgress }
