import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface LoadingProps {
  size?: "sm" | "md" | "lg"
  text?: string
  className?: string
}

export function Loading({ size = "md", text, className }: LoadingProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-6 w-6", 
    lg: "h-8 w-8"
  }

  const textSizeClasses = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-lg"
  }

  return (
    <div className={cn("flex items-center justify-center gap-2", className)}>
      <Loader2 className={cn("animate-spin text-blue-600", sizeClasses[size])} />
      {text && (
        <span className={cn("text-gray-600 dark:text-gray-400", textSizeClasses[size])}>
          {text}
        </span>
      )}
    </div>
  )
}

export function PageLoading({ text = "加载中..." }: { text?: string }) {
  return (
    <div className="flex items-center justify-center min-h-[200px]">
      <Loading size="lg" text={text} />
    </div>
  )
}

export function InlineLoading({ text }: { text?: string }) {
  return <Loading size="sm" text={text} className="inline-flex" />
}
