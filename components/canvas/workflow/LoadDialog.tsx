"use client"

import { Button } from "@/components/ui/button"
import { Trash2 } from "lucide-react"

interface LoadDialogProps {
  workflows: string[]
  onLoad: (name: string) => void
  onDelete: (name: string) => void
  onClose: () => void
}

export function LoadDialog({ workflows, onLoad, onDelete, onClose }: LoadDialogProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 w-80">
        <h3 className="text-sm font-semibold mb-2">读取工作流</h3>
        <div className="max-h-60 overflow-auto mb-4 border rounded-md dark:border-gray-700">
          {workflows.length === 0 ? (
            <p className="text-xs text-gray-500 p-4 text-center">没有保存的工作流</p>
          ) : (
            workflows.map((name) => (
              <div
                key={name}
                className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-900 border-b last:border-b-0 dark:border-gray-700"
              >
                <button
                  onClick={() => onLoad(name)}
                  className="text-sm text-left flex-1 hover:text-blue-500"
                >
                  {name}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(name) }}
                  className="text-gray-400 hover:text-red-500 p-1"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>关闭</Button>
        </div>
      </div>
    </div>
  )
}
