import { Globe } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"

export const httpTesterAdapter: ToolAdapter = {
  type: "http-tester",
  category: "dev",
  label: "HTTP Tester",
  icon: Globe,
  config: [
    {
      id: "url",
      name: "URL",
      dataType: "string",
      defaultValue: "",
      hasInput: true,
      hasOutput: false,
    },
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
      hasInput: true,
      hasOutput: true,
    },
    {
      id: "headers",
      name: "Headers",
      dataType: "string",
      defaultValue: "{}",
      multiline: true,
      hasInput: true,
      hasOutput: true,
    },
    {
      id: "body",
      name: "Body",
      dataType: "string",
      defaultValue: "",
      multiline: true,
      hasInput: true,
      hasOutput: false,
    },
  ],
  outputs: [
    { id: "response", name: "Response", dataType: "json" },
    { id: "status", name: "Status", dataType: "number" },
  ],
  async execute(inputs, config) {
    const url = String(inputs.url ?? config.url ?? "")
    const method = String(inputs.method ?? config.method ?? "GET")
    const body = inputs.body ? String(inputs.body) : config.body ? String(config.body) : undefined
    const headersStr = String(inputs.headers ?? config.headers ?? "{}")

    if (!url) {
      throw new Error("URL is required")
    }

    try {
      const parsed = new URL(url)
      if (!["http:", "https:"].includes(parsed.protocol)) {
        throw new Error(`Unsupported protocol: ${parsed.protocol}`)
      }
    } catch (e) {
      if (e instanceof TypeError) {
        throw new Error(`Invalid URL: ${url}`)
      }
      throw e
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
