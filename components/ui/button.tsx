import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[--md-sys-shape-corner-full] text-sm font-medium ring-offset-background transition-all duration-[--md-sys-motion-duration-short4] ease-[--md-sys-motion-easing-expressive] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-38 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-95 hover:shadow-sm",
  {
    variants: {
      variant: {
        default: "bg-md-primary text-md-on-primary hover:bg-md-primary/90 hover:shadow-md",
        destructive:
          "bg-md-error text-md-on-error hover:bg-md-error/90 hover:shadow-md",
        outline:
          "border border-md-outline bg-transparent text-md-primary hover:bg-md-primary/10",
        secondary:
          "bg-md-secondary-container text-md-on-secondary-container hover:bg-md-secondary-container/80 hover:shadow-sm",
        ghost: "hover:bg-md-on-surface/10 text-md-on-surface",
        link: "text-md-primary underline-offset-4 hover:underline",
        elevated: "bg-md-surface-container-low text-md-primary shadow-sm hover:bg-md-surface-container hover:shadow-md",
        tonal: "bg-md-secondary-container text-md-on-secondary-container hover:bg-md-secondary-container/80 hover:shadow-sm",
      },
      size: {
        default: "h-10 px-6 py-2",
        sm: "h-9 rounded-[--md-sys-shape-corner-full] px-4",
        lg: "h-12 rounded-[--md-sys-shape-corner-full] px-8 text-base",
        icon: "h-10 w-10 p-0 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
