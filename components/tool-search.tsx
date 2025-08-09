"use client"

import { useState, useCallback } from "react"
import { Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useTranslations } from "@/hooks/use-translations"

interface SearchResult {
  toolId: string
  toolName: string
  featureName: string
  featureDescription?: string
}

interface ToolSearchProps {
  onSearch: (term: string) => void
  searchResults: SearchResult[]
  onSelectResult: (toolId: string, featureName: string) => void
  className?: string
}

export function ToolSearch({ onSearch, searchResults, onSelectResult, className }: ToolSearchProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [isOpen, setIsOpen] = useState(false)
  const t = useTranslations("tools")

  const handleSearch = useCallback((term: string) => {
    setSearchTerm(term)
    setIsOpen(term.length > 0)
    onSearch(term)
  }, [onSearch])

  const handleSelectResult = useCallback((toolId: string, featureName: string) => {
    onSelectResult(toolId, featureName)
    setSearchTerm("")
    setIsOpen(false)
  }, [onSelectResult])

  const clearSearch = useCallback(() => {
    setSearchTerm("")
    setIsOpen(false)
    onSearch("")
  }, [onSearch])

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          type="text"
          value={searchTerm}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder={t("search.placeholder")}
          className="pl-10 pr-10 input-modern"
        />
        {searchTerm && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={clearSearch}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      {isOpen && searchResults.length > 0 && (
        <Card className="absolute z-50 w-full mt-2 p-2 max-h-80 overflow-y-auto card-modern shadow-lg">
          {searchResults.map((result, index) => (
            <button
              key={index}
              className="w-full p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
              onClick={() => handleSelectResult(result.toolId, result.featureName)}
            >
              <div className="font-medium text-gray-900 dark:text-gray-100">
                {result.featureName}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center mt-1">
                <span>{result.toolName}</span>
                {result.featureDescription && (
                  <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">
                    - {result.featureDescription}
                  </span>
                )}
              </div>
            </button>
          ))}
        </Card>
      )}
    </div>
  )
}
