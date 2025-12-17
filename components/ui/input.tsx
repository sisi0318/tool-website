import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-12 w-full rounded-[--md-sys-shape-corner-extra-small] border-b-2 border-transparent bg-md-surface-container-highest px-4 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-md-on-surface-variant/50 focus-visible:outline-none focus-visible:border-md-primary disabled:cursor-not-allowed disabled:opacity-38 md:text-sm transition-colors duration-[--md-sys-motion-duration-short2] ease-[--md-sys-motion-easing-standard]",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
