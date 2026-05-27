import { Palette } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"

export const colorAdapter: ToolAdapter = {
  type: "color",
  category: "utility",
  label: "Color",
  icon: Palette,
  inputs: [
    { id: "color", name: "Color", dataType: "string", required: true },
  ],
  outputs: [
    { id: "hex", name: "HEX", dataType: "string" },
    { id: "rgb", name: "RGB", dataType: "json" },
    { id: "hsl", name: "HSL", dataType: "json" },
  ],
  config: [],
  async execute(inputs, config) {
    const color = String(inputs.color ?? "#000000")

    const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
      return result
        ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16),
          }
        : null
    }

    const rgbToHsl = (r: number, g: number, b: number): { h: number; s: number; l: number } => {
      r /= 255
      g /= 255
      b /= 255
      const max = Math.max(r, g, b)
      const min = Math.min(r, g, b)
      let h = 0
      let s = 0
      const l = (max + min) / 2

      if (max !== min) {
        const d = max - min
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
        switch (max) {
          case r:
            h = ((g - b) / d + (g < b ? 6 : 0)) / 6
            break
          case g:
            h = ((b - r) / d + 2) / 6
            break
          case b:
            h = ((r - g) / d + 4) / 6
            break
        }
      }

      return {
        h: Math.round(h * 360),
        s: Math.round(s * 100),
        l: Math.round(l * 100),
      }
    }

    const rgb = hexToRgb(color)
    if (!rgb) {
      throw new Error("Invalid color format")
    }

    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b)

    return {
      hex: color,
      rgb,
      hsl,
    }
  },
}

export function registerColorAdapter(): void {
  registerNode(colorAdapter)
}
