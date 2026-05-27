import { Activity } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"

export const bmiAdapter: ToolAdapter = {
  type: "bmi",
  category: "utility",
  label: "BMI",
  icon: Activity,
  config: [
    {
      id: "weight",
      name: "Weight (kg)",
      dataType: "number",
      defaultValue: 70,
      hasInput: true,
      hasOutput: false,
    },
    {
      id: "height",
      name: "Height (m)",
      dataType: "number",
      defaultValue: 1.75,
      hasInput: true,
      hasOutput: false,
    },
  ],
  outputs: [
    { id: "bmi", name: "BMI", dataType: "number" },
    { id: "category", name: "Category", dataType: "string" },
  ],
  async execute(inputs, config) {
    const weight = Number(inputs.weight ?? config.weight ?? 0)
    const height = Number(inputs.height ?? config.height ?? 0)

    if (weight <= 0 || height <= 0) {
      throw new Error("Weight and height must be positive numbers")
    }

    const bmi = weight / (height * height)
    let category: string

    if (bmi < 18.5) {
      category = "Underweight"
    } else if (bmi < 25) {
      category = "Normal weight"
    } else if (bmi < 30) {
      category = "Overweight"
    } else {
      category = "Obese"
    }

    return {
      bmi: Math.round(bmi * 100) / 100,
      category,
    }
  },
}

export function registerBmiAdapter(): void {
  registerNode(bmiAdapter)
}
