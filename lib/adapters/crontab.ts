import { Clock } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"

export const crontabAdapter: ToolAdapter = {
  type: "crontab",
  category: "dev",
  label: "Crontab",
  icon: Clock,
  config: [
    {
      id: "expression",
      name: "Expression",
      dataType: "string",
      defaultValue: "* * * * *",
      hasInput: true,
      hasOutput: false,
    },
  ],
  outputs: [
    { id: "parsed", name: "Parsed", dataType: "json" },
    { id: "nextRuns", name: "Next Runs", dataType: "json" },
  ],
  async execute(inputs, config) {
    const expression = String(inputs.expression ?? config.expression ?? "* * * * *")

    const parts = expression.trim().split(/\s+/)
    if (parts.length !== 5) {
      throw new Error("Crontab expression must have 5 parts: minute hour day month weekday")
    }

    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts

    const parseField = (field: string, min: number, max: number): number[] => {
      if (field === "*") {
        return Array.from({ length: max - min + 1 }, (_, i) => i + min)
      }
      if (field.includes(",")) {
        return field.split(",").flatMap((part) => parseField(part, min, max))
      }
      if (field.includes("/")) {
        const [range, step] = field.split("/")
        const start = range === "*" ? min : parseInt(range)
        const stepNum = parseInt(step)
        const values: number[] = []
        for (let i = start; i <= max; i += stepNum) {
          values.push(i)
        }
        return values
      }
      if (field.includes("-")) {
        const [start, end] = field.split("-").map(Number)
        return Array.from({ length: end - start + 1 }, (_, i) => start + i)
      }
      return [parseInt(field)]
    }

    const parsed = {
      minute: parseField(minute, 0, 59),
      hour: parseField(hour, 0, 23),
      dayOfMonth: parseField(dayOfMonth, 1, 31),
      month: parseField(month, 1, 12),
      dayOfWeek: parseField(dayOfWeek, 0, 6),
    }

    const now = new Date()
    const nextRuns: Date[] = []
    const current = new Date(now)
    current.setSeconds(0)
    current.setMilliseconds(0)
    current.setMinutes(current.getMinutes() + 1)

    for (let i = 0; i < 5; i++) {
      while (true) {
        if (
          parsed.minute.includes(current.getMinutes()) &&
          parsed.hour.includes(current.getHours()) &&
          parsed.dayOfMonth.includes(current.getDate()) &&
          parsed.month.includes(current.getMonth() + 1) &&
          parsed.dayOfWeek.includes(current.getDay())
        ) {
          nextRuns.push(new Date(current))
          current.setMinutes(current.getMinutes() + 1)
          break
        }
        current.setMinutes(current.getMinutes() + 1)
      }
    }

    return {
      parsed,
      nextRuns: nextRuns.map((d) => d.toISOString()),
    }
  },
}

export function registerCrontabAdapter(): void {
  registerNode(crontabAdapter)
}
