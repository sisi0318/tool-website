import { Clock3 } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"

/**
 * 10 位按秒解释、13 位按毫秒:这是 Unix 时间戳最常见的两种写法。
 * 阈值 1e11 毫秒约为 1973-03,晚于此的毫秒戳一定大于该值,而秒级时间戳
 * 要到公元 5138 年才会越过它。
 */
const SECONDS_THRESHOLD = 1e11

function fromEpoch(value: number): Date {
  const date = new Date(Math.abs(value) < SECONDS_THRESHOLD ? value * 1000 : value)
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid timestamp: ${value}`)
  return date
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
  if (/^-?\d+$/.test(text)) return fromEpoch(Number(text))

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
