import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { LucideIcon } from "lucide-react"
import * as LucideIcons from "lucide-react"

interface Tool {
  id: string
  name: string
  description: string
  icon: string
  href: string
  category?: string
  isNew?: boolean
  isPopular?: boolean
}

interface ToolGridProps {
  tools: Tool[]
  showDescription?: boolean
}

export function ToolGrid({ tools, showDescription = false }: ToolGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {tools.map((tool) => {
        // 动态获取图标组件
        const IconComponent = LucideIcons[tool.icon as keyof typeof LucideIcons] as LucideIcon

        return (
          <Link key={tool.id} href={tool.href} className="group">
            <Card className="h-full card-modern hover-lift group-hover:border-blue-200 dark:group-hover:border-blue-700 overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  {IconComponent && (
                    <div className="icon-container">
                      <IconComponent className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    </div>
                  )}
                  <div className="flex gap-1">
                    {tool.isNew && (
                      <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                        新
                      </Badge>
                    )}
                    {tool.isPopular && (
                      <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300">
                        热门
                      </Badge>
                    )}
                  </div>
                </div>
                
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {tool.name}
                </h3>
                
                {showDescription && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 leading-relaxed">
                    {tool.description}
                  </p>
                )}
                
                {tool.category && (
                  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {tool.category}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          </Link>
        )
      })}
    </div>
  )
}
