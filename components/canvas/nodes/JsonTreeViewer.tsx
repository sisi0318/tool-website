"use client"

import { useState, useCallback } from "react"

/** 每层最多渲染的子项数。十万条的数组展开成十万个 DOM 节点,画布会直接卡死 */
const MAX_CHILDREN = 200

function OverflowRow({ hidden }: { hidden: number }) {
  if (hidden <= 0) return null
  return <div className="text-md-on-surface-variant opacity-70">… +{hidden.toLocaleString()}</div>
}

interface JsonTreeViewerProps {
  data: unknown
  depth?: number
}

export function JsonTreeViewer({ data, depth = 0 }: JsonTreeViewerProps) {
  const [expanded, setExpanded] = useState(depth < 2)

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setExpanded((prev) => !prev)
  }, [])

  if (data === null) return <span className="text-md-on-surface-variant opacity-60">null</span>
  if (data === undefined) return <span className="text-md-on-surface-variant opacity-60">undefined</span>
  if (typeof data === "boolean") return <span className="text-md-on-surface-variant">{String(data)}</span>
  if (typeof data === "number") return <span className="text-md-primary">{data}</span>
  if (typeof data === "string") return <span className="text-md-tertiary">&quot;{data}&quot;</span>

  if (Array.isArray(data)) {
    return (
      <div className="font-mono text-[10px]">
        <button onClick={handleClick} className="text-md-on-surface-variant hover:text-md-on-surface">
          {expanded ? "▼" : "▶"} [{data.length}]
        </button>
        {expanded && (
          <div className="ml-4 border-l border-md-outline-variant pl-2">
            {data.slice(0, MAX_CHILDREN).map((item, i) => (
              <div key={i} className="flex gap-1">
                <span className="text-md-on-surface-variant">{i}:</span>
                <JsonTreeViewer data={item} depth={depth + 1} />
              </div>
            ))}
            <OverflowRow hidden={data.length - MAX_CHILDREN} />
          </div>
        )}
      </div>
    )
  }

  if (typeof data === "object") {
    const entries = Object.entries(data as Record<string, unknown>)
    return (
      <div className="font-mono text-[10px]">
        <button onClick={handleClick} className="text-md-on-surface-variant hover:text-md-on-surface">
          {expanded ? "▼" : "▶"} {"{"}
          {entries.length}
          {"}"}
        </button>
        {expanded && (
          <div className="ml-4 border-l border-md-outline-variant pl-2">
            {entries.slice(0, MAX_CHILDREN).map(([key, value]) => (
              <div key={key} className="flex gap-1">
                <span className="text-md-secondary">&quot;{key}&quot;</span>:
                <JsonTreeViewer data={value} depth={depth + 1} />
              </div>
            ))}
            <OverflowRow hidden={entries.length - MAX_CHILDREN} />
          </div>
        )}
      </div>
    )
  }

  return <span>{String(data)}</span>
}
