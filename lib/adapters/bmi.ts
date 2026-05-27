import { Activity } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"

export const bmiAdapter: ToolAdapter = {
  type: "bmi",
  category: "utility",
  label: "BMI",
  icon: Activity,
  inputs: [
    { id: "weight", name: "Weight (kg)", dataType: "number", required: true },
    { id: "height", name: "Height (m)", dataType: "number", required: true },
  ],
  outputs: [
    { id: "bmi", name: "BMI", dataType: "number" },
    { id: "category", name: "Category", dataType: "string" },
  ],
  config: [],
  async execute(inputs, config) {
    const weight = Number(inputs.weight ?? 0)
    const height = Number(inputs.height ?? 0)

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
