import { Thermometer } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"

const UNITS = [
  { label: "Celsius", value: "celsius" },
  { label: "Fahrenheit", value: "fahrenheit" },
  { label: "Kelvin", value: "kelvin" },
]

function convert(value: number, from: string, to: string): number {
  let celsius: number
  switch (from) {
    case "celsius":
      celsius = value
      break
    case "fahrenheit":
      celsius = (value - 32) * (5 / 9)
      break
    case "kelvin":
      celsius = value - 273.15
      break
    default:
      celsius = value
  }

  switch (to) {
    case "celsius":
      return celsius
    case "fahrenheit":
      return celsius * (9 / 5) + 32
    case "kelvin":
      return celsius + 273.15
    default:
      return celsius
  }
}

export const temperatureConverterAdapter: ToolAdapter = {
  type: "temperature-converter",
  category: "utility",
  label: "Temperature",
  icon: Thermometer,
  inputs: [{ id: "value", name: "Value", dataType: "number", required: true }],
  outputs: [
    { id: "celsius", name: "Celsius", dataType: "number" },
    { id: "fahrenheit", name: "Fahrenheit", dataType: "number" },
    { id: "kelvin", name: "Kelvin", dataType: "number" },
  ],
  config: [
    {
      id: "fromUnit",
      name: "Input Unit",
      dataType: "string",
      defaultValue: "celsius",
      options: UNITS,
    },
  ],
  async execute(inputs, config) {
    const value = Number(inputs.value ?? 0)
    const fromUnit = String(config.fromUnit ?? "celsius")

    return {
      celsius: Math.round(convert(value, fromUnit, "celsius") * 100) / 100,
      fahrenheit: Math.round(convert(value, fromUnit, "fahrenheit") * 100) / 100,
      kelvin: Math.round(convert(value, fromUnit, "kelvin") * 100) / 100,
    }
  },
}

export function registerTemperatureConverterAdapter(): void {
  registerNode(temperatureConverterAdapter)
}
