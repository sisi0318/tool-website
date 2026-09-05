"use client"

import * as React from "react"
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group"

import { cn } from "@/lib/utils"

/**
 * 单选分段控件,外观沿用 Tabs 的 TabsList / TabsTrigger。
 *
 * 之前这些"选算法 / 选模式"的地方直接拿 Tabs 充当,但并没有对应的 TabsContent,
 * 每个触发器的 aria-controls 都指向一个不存在的面板(axe: aria-valid-attr-value)。
 * 这里的语义是 radiogroup / radio:方向键在选项间移动由 Radix 提供,
 * 选中态用 data-state="checked"。
 */
const SegmentedControl = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>
>(({ className, ...props }, ref) => (
  <RadioGroupPrimitive.Root
    ref={ref}
    className={cn(
      "inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground",
      className,
    )}
    {...props}
  />
))
SegmentedControl.displayName = "SegmentedControl"

const SegmentedControlItem = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>
>(({ className, ...props }, ref) => (
  <RadioGroupPrimitive.Item
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=checked]:bg-background data-[state=checked]:text-foreground data-[state=checked]:shadow-sm",
      className,
    )}
    {...props}
  />
))
SegmentedControlItem.displayName = "SegmentedControlItem"

export { SegmentedControl, SegmentedControlItem }
