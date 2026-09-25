import { Clock3 } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"
import { parseTimestamp } from "../timestamp-tools"

/** 单位按位数识别(10 位秒、13 位毫秒、16 位微秒、19 位纳秒),与时间工具页共用 */
function fromEpoch(value: number | string): Date {
  const result = parseTimestamp(String(value))
  if (!result.ok) throw new Error(`Invalid timestamp: ${value}`)
  return result.date
}

/** 空输入表示"此刻";其余按时间戳或可解析的日期字符串处理。 */
export function parseTimeInput(raw: unknown): Date {
  if (raw === undefined || raw === null) return new Date()
  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) throw new Error("Invalid date")
    return raw
  }
  if (typeof raw === "number") return fromEpoch(raw)

  const text = String(raw).trim()
  if (text === "") return new Date()
  if (/^-?\d+$/.test(text)) return fromEpoch(text)

  const parsed = new Date(text)
  if (Number.isNaN(parsed.getTime())) throw new Error(`Unrecognized time value: ${text}`)
  return parsed
}

export const timeAdapter: ToolAdapter = {
  type: "time",
  category: "viewer",
  label: "Time",
  icon: Clock3,
  config: [
    // 主输入端口必须排在第一个:journey 按"第一个 hasInput 字段"投递上游值,
    // 早先这里只有 timezone,于是时间戳被当成时区名并被 execute 完全忽略。
    {
      id: "value",
      name: "Time value",
      dataType: "string",
      defaultValue: "",
      hasInput: true,
      hasOutput: false,
    },
    {
      id: "timezone",
      name: "Timezone",
      dataType: "string",
      defaultValue: "UTC",
      options: [
        { label: "UTC", value: "UTC" },
        { label: "Local", value: "local" },
      ],
      hasInput: true,
      hasOutput: true,
    },
  ],
  outputs: [
    { id: "timestamp", name: "Timestamp", dataType: "number" },
    { id: "iso", name: "ISO", dataType: "string" },
    { id: "formatted", name: "Formatted", dataType: "string" },
    { id: "parts", name: "Parts", dataType: "json" },
  ],
  async execute(inputs, config) {
    const date = parseTimeInput(inputs.value ?? config.value)
    const useUtc = String(inputs.timezone ?? config.timezone ?? "UTC") !== "local"

    return {
      timestamp: date.getTime(),
      iso: date.toISOString(),
      formatted: date.toLocaleString(undefined, useUtc ? { timeZone: "UTC" } : undefined),
      parts: {
        year: useUtc ? date.getUTCFullYear() : date.getFullYear(),
        month: (useUtc ? date.getUTCMonth() : date.getMonth()) + 1,
        day: useUtc ? date.getUTCDate() : date.getDate(),
        hours: useUtc ? date.getUTCHours() : date.getHours(),
        minutes: useUtc ? date.getUTCMinutes() : date.getMinutes(),
        seconds: useUtc ? date.getUTCSeconds() : date.getSeconds(),
        milliseconds: useUtc ? date.getUTCMilliseconds() : date.getMilliseconds(),
        dayOfWeek: useUtc ? date.getUTCDay() : date.getDay(),
      },
    }
  },
}

export function registerTimeAdapter(): void {
  registerNode(timeAdapter)
}
