import { Globe } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"

export const httpTesterAdapter: ToolAdapter = {
  type: "http-tester",
  category: "dev",
  label: "HTTP Tester",
  executionMode: "manual",
  network: true,
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
      sensitive: true,
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
  async execute(inputs, config, context) {
    const url = String(inputs.url ?? config.url ?? "")
    const method = String(inputs.method ?? config.method ?? "GET")
    // 用真值判断会让"上游显式给了空 body"退回到 config 里的旧 body。
    // 只要端口上有值(哪怕是空串)就以它为准。
    const rawBody = inputs.body !== undefined && inputs.body !== null ? inputs.body : config.body
    const body = rawBody === undefined || rawBody === null ? undefined : String(rawBody)
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

    // headers 解析失败与网络失败以前共用一条 "HTTP error" 文案,难以区分。
    let headers: Record<string, string>
    try {
      headers = JSON.parse(headersStr)
    } catch {
      throw new Error("Headers must be a JSON object")
    }

    try {
      const options: RequestInit = {
        method,
        headers,
        // 超时、被更新的图取代或用户点停止时,请求要真的中断
        signal: context?.signal,
      }

      // 空串是合法的请求体,不能用真值判断丢掉。
      if (body !== undefined && method !== "GET" && method !== "HEAD") {
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
