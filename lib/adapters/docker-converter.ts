import { Container } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"

export const dockerConverterAdapter: ToolAdapter = {
  type: "docker-converter",
  category: "dev",
  label: "Docker Converter",
  icon: Container,
  inputs: [
    { id: "command", name: "Command", dataType: "string", required: true },
  ],
  outputs: [
    { id: "dockerfile", name: "Dockerfile", dataType: "string" },
    { id: "compose", name: "Compose", dataType: "string" },
  ],
  config: [
    {
      id: "format",
      name: "Format",
      dataType: "string",
      defaultValue: "dockerfile",
      options: [
        { label: "Dockerfile", value: "dockerfile" },
        { label: "Docker Compose", value: "compose" },
      ],
    },
  ],
  async execute(inputs, config) {
    const command = String(inputs.command ?? "")
    const format = String(config.format ?? "dockerfile")

    const dockerfile = `FROM ubuntu:latest
RUN apt-get update && apt-get install -y ${command}
CMD ["${command}"]`

    const compose = `version: '3'
services:
  app:
    image: ubuntu:latest
    command: ${command}`

    return {
      dockerfile,
      compose,
    }
  },
}

export function registerDockerConverterAdapter(): void {
  registerNode(dockerConverterAdapter)
}
