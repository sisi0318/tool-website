import { Globe } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"

export const httpTesterAdapter: ToolAdapter = {
  type: "http-tester",
  category: "dev",
  label: "HTTP Tester",
  icon: Globe,
  inputs: [
    { id: "url", name: "URL", dataType: "string", required: true },
    { id: "body", name: "Body", dataType: "string" },
  ],
  outputs: [
    { id: "response", name: "Response", dataType: "json" },
    { id: "status", name: "Status", dataType: "number" },
  ],
  config: [
    {
      id: "method",
      name: "Method",
      dataType: "string",
      defaultValue: "GET",
      options: [
        { label: "GET", value: "GET" },
        { label: "POST", value: "POST" },
        { label: "PUT", value: "PUT" },
        { label: "DELETE", value: "DELETE" },
        { label: "PATCH", value: "PATCH" },
      ],
    },
    {
      id: "headers",
      name: "Headers",
      dataType: "string",
      defaultValue: "{}",
      multiline: true,
    },
  ],
  async execute(inputs, config) {
    const url = String(inputs.url ?? "")
    const method = String(config.method ?? "GET")
    const body = inputs.body ? String(inputs.body) : undefined
    const headersStr = String(config.headers ?? "{}")

    if (!url) {
      throw new Error("URL is required")
    }

    try {
      const headers: Record<string, string> = JSON.parse(headersStr)
      const options: RequestInit = {
        method,
        headers,
      }

      if (body && method !== "GET") {
        options.body = body
      }

      const response = await fetch(url, options)
      const data = await response.text()

      let parsed: unknown
      try {
        parsed = JSON.parse(data)
      } catch {
        parsed = data
      }

      return {
        response: parsed,
        status: response.status,
      }
    } catch (error) {
      throw new Error(`HTTP error: ${error}`)
    }
  },
}

export function registerHttpTesterAdapter(): void {
  registerNode(httpTesterAdapter)
}
