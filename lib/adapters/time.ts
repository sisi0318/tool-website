import { Clock3 } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"

export const timeAdapter: ToolAdapter = {
  type: "time",
  category: "viewer",
  label: "Time",
  icon: Clock3,
  inputs: [],
  outputs: [
    { id: "timestamp", name: "Timestamp", dataType: "number" },
    { id: "iso", name: "ISO", dataType: "string" },
    { id: "formatted", name: "Formatted", dataType: "string" },
    { id: "parts", name: "Parts", dataType: "json" },
  ],
  config: [
    {
      id: "timezone",
      name: "Timezone",
      dataType: "string",
      defaultValue: "UTC",
      options: [
        { label: "UTC", value: "UTC" },
        { label: "Local", value: "local" },
      ],
    },
  ],
  async execute(inputs, config) {
    const timezone = String(config.timezone ?? "UTC")
    const now = new Date()

    return {
      timestamp: now.getTime(),
      iso: now.toISOString(),
      formatted: now.toLocaleString(),
      parts: {
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        day: now.getDate(),
        hours: now.getHours(),
        minutes: now.getMinutes(),
        seconds: now.getSeconds(),
        milliseconds: now.getMilliseconds(),
        dayOfWeek: now.getDay(),
      },
    }
  },
}

export function registerTimeAdapter(): void {
  registerNode(timeAdapter)
}
