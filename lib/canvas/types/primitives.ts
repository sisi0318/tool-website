import type { DataType } from "../types"

export const TYPE_COLORS: Record<DataType, string> = {
  string: "#3b82f6",
  number: "#22c55e",
  json: "#a855f7",
  bytes: "#f97316",
}

export const TYPE_BG_COLORS: Record<DataType, string> = {
  string: "#eff6ff",
  number: "#f0fdf4",
  json: "#faf5ff",
  bytes: "#fff7ed",
}

export const TYPE_LABELS: Record<DataType, string> = {
  string: "String",
  number: "Number",
  json: "JSON",
  bytes: "Bytes",
}
