import { CaseSensitive } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"

export const caseConverterAdapter: ToolAdapter = {
  type: "case-converter",
  category: "text",
  label: "Case Converter",
  icon: CaseSensitive,
  config: [
    {
      id: "text",
      name: "Text",
      dataType: "string",
      defaultValue: "",
      hasInput: true,
      hasOutput: false,
    },
  ],
  outputs: [
    { id: "upper", name: "UPPER", dataType: "string" },
    { id: "lower", name: "lower", dataType: "string" },
    { id: "title", name: "Title", dataType: "string" },
    { id: "camel", name: "camelCase", dataType: "string" },
    { id: "snake", name: "snake_case", dataType: "string" },
    { id: "kebab", name: "kebab-case", dataType: "string" },
  ],
  async execute(inputs, config) {
    const text = String(inputs.text ?? config.text ?? "")

    const toCamelCase = (str: string): string => {
      return str
        .replace(/[^a-zA-Z0-9]+(.)/g, (_, char) => char.toUpperCase())
        .replace(/^[A-Z]/, (char) => char.toLowerCase())
    }

    const toSnakeCase = (str: string): string => {
      return str
        .replace(/([A-Z])/g, "_$1")
        .toLowerCase()
        .replace(/^_/, "")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, "")
    }

    const toKebabCase = (str: string): string => {
      return str
        .replace(/([A-Z])/g, "-$1")
        .toLowerCase()
        .replace(/^-/, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
    }

    const toTitleCase = (str: string): string => {
      return str.replace(/\b\w/g, (char) => char.toUpperCase())
    }

    return {
      upper: text.toUpperCase(),
      lower: text.toLowerCase(),
      title: toTitleCase(text),
      camel: toCamelCase(text),
      snake: toSnakeCase(text),
      kebab: toKebabCase(text),
    }
  },
}

export function registerCaseConverterAdapter(): void {
  registerNode(caseConverterAdapter)
}
