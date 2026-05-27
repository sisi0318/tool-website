import { Container } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"

export const dockerConverterAdapter: ToolAdapter = {
  type: "docker-converter",
  category: "dev",
  label: "Docker Converter",
  icon: Container,
  config: [
    {
      id: "command",
      name: "Command",
      dataType: "string",
      defaultValue: "",
      hasInput: true,
      hasOutput: false,
    },
    {
      id: "format",
      name: "Format",
      dataType: "string",
      defaultValue: "dockerfile",
      options: [
        { label: "Dockerfile", value: "dockerfile" },
        { label: "Docker Compose", value: "compose" },
      ],
      hasInput: true,
      hasOutput: true,
    },
  ],
  outputs: [
    { id: "dockerfile", name: "Dockerfile", dataType: "string" },
    { id: "compose", name: "Compose", dataType: "string" },
  ],
  async execute(inputs, config) {
    const command = String(inputs.command ?? config.command ?? "")

    return {
      dockerfile: `FROM ubuntu:latest\nRUN apt-get update && apt-get install -y ${command}\nCMD ["${command}"]`,
      compose: `version: '3'\nservices:\n  app:\n    image: ubuntu:latest\n    command: ${command}`,
    }
  },
}

export function registerDockerConverterAdapter(): void {
  registerNode(dockerConverterAdapter)
}
