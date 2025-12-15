"use client"

import type React from "react"

import { useState, useEffect, useRef, useMemo } from "react"
import { useTranslations } from "@/hooks/use-translations"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Check, Copy, X, Settings, ChevronUp, ChevronDown, Palette, Zap, RefreshCw, Eye, Pipette } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { debounce } from "lodash"

interface ColorPickerProps {
  params?: Record<string, string>
}

// Extended color names mapping
const COLOR_NAMES: Record<string, string> = {
  "#000000": "black",
  "#ffffff": "white",
  "#ff0000": "red",
  "#00ff00": "lime",
  "#0000ff": "blue",
  "#ffff00": "yellow",
  "#00ffff": "cyan",
  "#ff00ff": "magenta",
  "#c0c0c0": "silver",
  "#808080": "gray",
  "#800000": "maroon",
  "#808000": "olive",
  "#008000": "green",
  "#800080": "purple",
  "#008080": "teal",
  "#000080": "navy",
  "#228b22": "forestgreen",
  "#106a2f": "forestgreen",
  "#2e8b57": "seagreen",
  "#3cb371": "mediumseagreen",
  "#20b2aa": "lightseagreen",
  "#98fb98": "palegreen",
  "#00fa9a": "mediumspringgreen",
  "#7cfc00": "lawngreen",
  "#00ff7f": "springgreen",
  "#7fff00": "chartreuse",
  "#adff2f": "greenyellow",
  "#32cd32": "limegreen",
  "#9acd32": "yellowgreen",
  "#6b8e23": "olivedrab",
  "#556b2f": "darkolivegreen",
  "#66cdaa": "mediumaquamarine",
  "#8fbc8f": "darkseagreen",
  "#f0e68c": "khaki",
  "#eee8aa": "palegoldenrod",
  "#bdb76b": "darkkhaki",
  "#f5f5dc": "beige",
  "#fafad2": "lightgoldenrodyellow",
  "#fffacd": "lemonchiffon",
  "#ffffe0": "lightyellow",
  "#ffd700": "gold",
  "#daa520": "goldenrod",
  "#b8860b": "darkgoldenrod",
  "#bc8f8f": "rosybrown",
  "#cd5c5c": "indianred",
  "#8b4513": "saddlebrown",
  "#a0522d": "sienna",
  "#cd853f": "peru",
  "#deb887": "burlywood",
  "#f5deb3": "wheat",
  "#ffe4b5": "moccasin",
  "#ffa500": "orange",
  "#ff8c00": "darkorange",
  "#ff7f50": "coral",
  "#ff6347": "tomato",
  "#ff4500": "orangered",
  "#dc143c": "crimson",
  "#c71585": "mediumvioletred",
  "#ff1493": "deeppink",
  "#ff69b4": "hotpink",
  "#ffb6c1": "lightpink",
  "#ffc0cb": "pink",
  "#db7093": "palevioletred",
  "#ee82ee": "violet",
  "#dda0dd": "plum",
  "#da70d6": "orchid",
  "#ba55d3": "mediumorchid",
  "#9370db": "mediumpurple",
  "#8a2be2": "blueviolet",
  "#9400d3": "darkviolet",
  "#9932cc": "darkorchid",
  "#8b008b": "darkmagenta",
  "#4b0082": "indigo",
  "#483d8b": "darkslateblue",
  "#6a5acd": "slateblue",
  "#7b68ee": "mediumslateblue",
  "#0000cd": "mediumblue",
  "#00008b": "darkblue",
  "#191970": "midnightblue",
  "#6495ed": "cornflowerblue",
  "#4169e1": "royalblue",
  "#1e90ff": "dodgerblue",
  "#00bfff": "deepskyblue",
  "#87ceeb": "skyblue",
  "#87cefa": "lightskyblue",
  "#4682b4": "steelblue",
  "#b0c4de": "lightsteelblue",
  "#add8e6": "lightblue",
  "#b0e0e6": "powderblue",
  "#afeeee": "paleturquoise",
  "#e0ffff": "lightcyan",
  "#00ced1": "darkturquoise",
  "#2f4f4f": "darkslategray",
  "#696969": "dimgray",
  "#a9a9a9": "darkgray",
  "#d3d3d3": "lightgray",
  "#dcdcdc": "gainsboro",
  "#f5f5f5": "whitesmoke",
  "#f8f8ff": "ghostwhite",
  "#f0f8ff": "aliceblue",
  "#e6e6fa": "lavender",
  "#fffaf0": "floralwhite",
  "#faf0e6": "linen",
  "#faebd7": "antiquewhite",
  "#ffe4c4": "bisque",
  "#ffdead": "navajowhite",
  "#f5fffa": "mintcream",
  "#f0fff0": "honeydew",
  "#fffafa": "snow",
  "#fff5ee": "seashell",
  "#fff0f5": "lavenderblush",
  "#fdf5e6": "oldlace",
  "#ffe4e1": "mistyrose",
  "#ffdab9": "peachpuff",
  "#ffefd5": "papayawhip",
  "#ffebcd": "blanchedalmond",
  "#d2b48c": "tan",
  "#f4a460": "sandybrown",
  "#d2691e": "chocolate",
  "#b22222": "firebrick",
  "#a52a2a": "brown",
  "#8b0000": "darkred",
}

// Common colors for the color palette
const COMMON_COLORS = [
  "#ff0000",
  "#ff4500",
  "#ff8c00",
  "#ffd700",
  "#ffff00",
  "#adff2f",
  "#32cd32",
  "#008000",
  "#00fa9a",
  "#00ffff",
  "#0000ff",
  "#8a2be2",
  "#ff00ff",
  "#ff1493",
  "#ffffff",
  "#000000",
  "#808080",
  "#a52a2a",
]

// Reverse mapping for name to hex
const NAME_TO_HEX: Record<string, string> = Object.entries(COLOR_NAMES).reduce(
  (acc, [hex, name]) => {
    acc[name.toLowerCase()] = hex
    return acc
  },
  {} as Record<string, string>,
)

interface ColorFormat {
  label: string
  value: string
  copied: boolean
}

export default function ColorPickerPage({ params }: ColorPickerProps) {
  const t = useTranslations("color")
  
  // 基础状态
  const [showColorSettings, setShowColorSettings] = useState(false)
  const [autoSync, setAutoSync] = useState(true)
  const [showPreview, setShowPreview] = useState(true)
  const [enableNameDetection, setEnableNameDetection] = useState(true)
  
  const [color, setColor] = useState("#106a2f")
  const [formats, setFormats] = useState<ColorFormat[]>([
    { label: "hex", value: "#106a2f", copied: false },
    { label: "rgb", value: "rgb(16, 106, 47)", copied: false },
    { label: "hsl", value: "hsl(141, 74%, 24%)", copied: false },
    { label: "hwb", value: "hwb(141 6% 58%)", copied: false },
    { label: "lch", value: "lch(38.93% 44.59 145.3)", copied: false },
    { label: "cmyk", value: "device-cmyk(85% 0% 56% 58%)", copied: false },
    { label: "name", value: "forestgreen", copied: false },
  ])
  const [recentColors, setRecentColors] = useState<string[]>([])

  const copyTimeoutsRef = useRef<Record<string, NodeJS.Timeout>>({})

  // Find the closest named color
  // Pre-compute RGB values for all named colors (only once)
  const namedColorsWithRgb = useMemo(() => {
    return Object.entries(COLOR_NAMES).map(([hex, name]) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
      const rgb = result
        ? [Number.parseInt(result[1], 16), Number.parseInt(result[2], 16), Number.parseInt(result[3], 16)] as [number, number, number]
        : null
      return { hex, name, rgb }
    }).filter(item => item.rgb !== null)
  }, [])

  const findClosestNamedColor = (hexColor: string): string => {
    // Try exact match first
    const normalizedHex = hexColor.toLowerCase()
    if (COLOR_NAMES[normalizedHex]) {
      return COLOR_NAMES[normalizedHex]
    }

    // If no exact match, find the closest color
    const rgb = hexToRgb(hexColor)
    if (!rgb) return ""

    const [r, g, b] = rgb

    let closestColor = ""
    let minDistance = Number.MAX_VALUE

    // Use pre-computed RGB values
    for (const item of namedColorsWithRgb) {
      if (!item.rgb) continue
      const [nr, ng, nb] = item.rgb
      // Use squared distance (avoid sqrt for performance)
      const distance = (r - nr) ** 2 + (g - ng) ** 2 + (b - nb) ** 2

      if (distance < minDistance) {
        minDistance = distance
        closestColor = item.name
      }
    }

    // Only return if the color is reasonably close (threshold: 50^2 = 2500)
    return minDistance < 2500 ? closestColor : ""
  }

  // Debounced update function to improve performance
  const debouncedUpdateFormats = useMemo(
    () =>
      debounce((hexColor: string) => {
        updateAllFormats(hexColor)
      }, 150),
    [],
  )

  // Debounced function to add to recent colors (separate from format updates)
  const debouncedAddToRecent = useMemo(
    () =>
      debounce((hexColor: string) => {
        setRecentColors((prev) => {
          if (prev.includes(hexColor)) return prev
          return [hexColor, ...prev.slice(0, 9)]
        })
      }, 500),
    [],
  )

  // Update all color formats when the color changes
  useEffect(() => {
    debouncedUpdateFormats(color)
    debouncedAddToRecent(color)

    return () => {
      debouncedUpdateFormats.cancel()
    }
  }, [color, debouncedUpdateFormats, debouncedAddToRecent])

  // Clean up timeouts on unmount
  useEffect(() => {
    return () => {
      Object.values(copyTimeoutsRef.current).forEach((timeout) => clearTimeout(timeout))
    }
  }, [])

  // Convert hex to RGB
  const hexToRgb = (hex: string): [number, number, number] | null => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result
      ? [Number.parseInt(result[1], 16), Number.parseInt(result[2], 16), Number.parseInt(result[3], 16)]
      : null
  }

  // Convert RGB to HSL
  const rgbToHsl = (r: number, g: number, b: number): [number, number, number] => {
    r /= 255
    g /= 255
    b /= 255
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    let h = 0,
      s = 0,
      l = (max + min) / 2

    if (max !== min) {
      const d = max - min
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
      switch (max) {
        case r:
          h = (g - b) / d + (g < b ? 6 : 0)
          break
        case g:
          h = (b - r) / d + 2
          break
        case b:
          h = (r - g) / d + 4
          break
      }
      h /= 6
    }

    return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)]
  }

  // Convert RGB to HWB
  const rgbToHwb = (r: number, g: number, b: number): [number, number, number] => {
    r /= 255
    g /= 255
    b /= 255
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const white = min
    const black = 1 - max

    let h = 0
    if (max !== min) {
      const d = max - min
      switch (max) {
        case r:
          h = (g - b) / d + (g < b ? 6 : 0)
          break
        case g:
          h = (b - r) / d + 2
          break
        case b:
          h = (r - g) / d + 4
          break
      }
      h /= 6
    }

    return [Math.round(h * 360), Math.round(white * 100), Math.round(black * 100)]
  }

  // Convert RGB to LCH (approximation)
  const rgbToLch = (r: number, g: number, b: number): [number, number, number] => {
    // This is a simplified approximation
    const [h, s, l] = rgbToHsl(r, g, b)
    const lightness = l
    const chroma = s * 1.5 // Simplified approximation
    const hue = h

    return [
      Number.parseFloat((lightness * 0.8).toFixed(2)),
      Number.parseFloat((chroma * 0.8).toFixed(2)),
      Number.parseFloat(hue.toFixed(1)),
    ]
  }

  // Convert RGB to CMYK
  const rgbToCmyk = (r: number, g: number, b: number): [number, number, number, number] => {
    r /= 255
    g /= 255
    b /= 255

    const k = 1 - Math.max(r, g, b)
    const c = k === 1 ? 0 : (1 - r - k) / (1 - k)
    const m = k === 1 ? 0 : (1 - g - k) / (1 - k)
    const y = k === 1 ? 0 : (1 - b - k) / (1 - k)

    return [Math.round(c * 100), Math.round(m * 100), Math.round(y * 100), Math.round(k * 100)]
  }

  // Update all color formats based on the current color
  const updateAllFormats = (hexColor: string) => {
    const rgb = hexToRgb(hexColor)
    if (!rgb) return

    const [r, g, b] = rgb
    const [h, s, l] = rgbToHsl(r, g, b)
    const [hw, ww, bw] = rgbToHwb(r, g, b)
    const [lc, cc, hc] = rgbToLch(r, g, b)
    const [cy, my, yy, ky] = rgbToCmyk(r, g, b)
    const name = findClosestNamedColor(hexColor)

    setFormats([
      { label: "hex", value: hexColor, copied: false },
      { label: "rgb", value: `rgb(${r}, ${g}, ${b})`, copied: false },
      { label: "hsl", value: `hsl(${h}, ${s}%, ${l}%)`, copied: false },
      { label: "hwb", value: `hwb(${hw} ${ww}% ${bw}%)`, copied: false },
      { label: "lch", value: `lch(${lc}% ${cc} ${hc})`, copied: false },
      { label: "cmyk", value: `device-cmyk(${cy}% ${my}% ${yy}% ${ky}%)`, copied: false },
      { label: "name", value: name, copied: false },
    ])
  }

  // Handle color input change
  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setColor(e.target.value)
  }

  // Handle format input change
  const handleFormatChange = (value: string, index: number) => {
    const newFormats = [...formats]
    newFormats[index].value = value
    setFormats(newFormats)

    // Try to parse the input and update the color
    try {
      const format = formats[index].label
      let newColor = color

      switch (format) {
        case "hex":
          if (/^#[0-9A-Fa-f]{6}$/i.test(value)) {
            newColor = value.toLowerCase()
          }
          break
        case "rgb":
          const rgbMatch = value.match(/rgb$$\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*$$/)
          if (rgbMatch) {
            const [_, r, g, b] = rgbMatch.map(Number)
            if (r >= 0 && r <= 255 && g >= 0 && g <= 255 && b >= 0 && b <= 255) {
              newColor = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`
            }
          }
          break
        case "hsl":
          const hslMatch = value.match(/hsl$$\s*(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%\s*$$/)
          if (hslMatch) {
            const [_, h, s, l] = hslMatch.map(Number)
            if (h >= 0 && h <= 360 && s >= 0 && s <= 100 && l >= 0 && l <= 100) {
              // Convert HSL to RGB
              const hue = h / 360
              const sat = s / 100
              const light = l / 100

              let r, g, b

              if (sat === 0) {
                r = g = b = light
              } else {
                const hue2rgb = (p: number, q: number, t: number) => {
                  if (t < 0) t += 1
                  if (t > 1) t -= 1
                  if (t < 1 / 6) return p + (q - p) * 6 * t
                  if (t < 1 / 2) return q
                  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
                  return p
                }

                const q = light < 0.5 ? light * (1 + sat) : light + sat - light * sat
                const p = 2 * light - q

                r = hue2rgb(p, q, hue + 1 / 3)
                g = hue2rgb(p, q, hue)
                b = hue2rgb(p, q, hue - 1 / 3)
              }

              const toHex = (x: number) => {
                const hex = Math.round(x * 255).toString(16)
                return hex.length === 1 ? "0" + hex : hex
              }

              newColor = `#${toHex(r)}${toHex(g)}${toHex(b)}`
            }
          }
          break
        case "hwb":
          const hwbMatch = value.match(/hwb$$\s*(\d+)\s+(\d+)%\s+(\d+)%\s*$$/)
          if (hwbMatch) {
            const [_, hwbH, hwbW, hwbB] = hwbMatch.map(Number)
            if (hwbH >= 0 && hwbH <= 360 && hwbW >= 0 && hwbW <= 100 && hwbB >= 0 && hwbB <= 100) {
              // Convert HWB to RGB (simplified conversion)
              const hue = hwbH / 360
              const white = hwbW / 100
              const black = hwbB / 100

              // If white + black exceeds 1, normalize them
              const sum = white + black
              const wn = sum > 1 ? white / sum : white
              const bn = sum > 1 ? black / sum : black

              // Convert to HSV first
              const v = 1 - bn
              const s = v === 0 ? 0 : 1 - wn / v

              // Then HSV to RGB
              const i = Math.floor(hue * 6)
              const f = hue * 6 - i
              const p = v * (1 - s)
              const q = v * (1 - f * s)
              const t = v * (1 - (1 - f) * s)

              let r, g, b
              switch (i % 6) {
                case 0:
                  r = v
                  g = t
                  b = p
                  break
                case 1:
                  r = q
                  g = v
                  b = p
                  break
                case 2:
                  r = p
                  g = v
                  b = t
                  break
                case 3:
                  r = p
                  g = q
                  b = v
                  break
                case 4:
                  r = t
                  g = p
                  b = v
                  break
                case 5:
                  r = v
                  g = p
                  b = q
                  break
                default:
                  r = 0
                  g = 0
                  b = 0
              }

              const toHex = (x: number) => {
                const hex = Math.round(x * 255).toString(16)
                return hex.length === 1 ? "0" + hex : hex
              }

              newColor = `#${toHex(r)}${toHex(g)}${toHex(b)}`
            }
          }
          break
        case "cmyk":
          const cmykMatch = value.match(/device-cmyk$$\s*(\d+)%\s+(\d+)%\s+(\d+)%\s+(\d+)%\s*$$/)
          if (cmykMatch) {
            const [_, c, m, y, k] = cmykMatch.map(Number)
            if (c >= 0 && c <= 100 && m >= 0 && m <= 100 && y >= 0 && y <= 100 && k >= 0 && k <= 100) {
              // Convert CMYK to RGB
              const cyan = c / 100
              const magenta = m / 100
              const yellow = y / 100
              const key = k / 100

              const r = Math.round(255 * (1 - cyan) * (1 - key))
              const g = Math.round(255 * (1 - magenta) * (1 - key))
              const b = Math.round(255 * (1 - yellow) * (1 - key))

              newColor = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`
            }
          }
          break
        case "name":
          const colorName = value.toLowerCase().trim()
          if (colorName in NAME_TO_HEX) {
            newColor = NAME_TO_HEX[colorName]
          }
          break
        // LCH conversion is complex and would require a more sophisticated color library
        // for accurate conversion, so we'll skip it for now
      }

      if (newColor !== color) {
        setColor(newColor)
      }
    } catch (error) {
      console.error("Error parsing color format:", error)
    }
  }

  // Handle clear button click
  const handleClear = (index: number) => {
    const newFormats = [...formats]
    newFormats[index].value = ""
    setFormats(newFormats)
  }

  // Handle copy button click
  const handleCopy = (index: number) => {
    const value = formats[index].value
    if (!value) return

    navigator.clipboard.writeText(value).then(() => {
      const newFormats = [...formats]
      newFormats[index].copied = true
      setFormats(newFormats)

      // Clear previous timeout
      if (copyTimeoutsRef.current[index]) {
        clearTimeout(copyTimeoutsRef.current[index])
      }

      // Set timeout to reset copied state
      copyTimeoutsRef.current[index] = setTimeout(() => {
        const resetFormats = [...formats]
        resetFormats[index].copied = false
        setFormats(resetFormats)
      }, 2000)
    })
  }

  // Handle color swatch click
  const handleSwatchClick = (swatchColor: string) => {
    setColor(swatchColor)
  }

  return (
    <div className="container mx-auto px-4 py-4 max-w-6xl">
      {/* 页面标题 */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200 mb-4 flex items-center justify-center gap-2">
          <Palette className="h-8 w-8 text-pink-600" />
          颜色选择器
        </h1>
      </div>

      {/* 颜色设置折叠区域 */}
      <div className="mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowColorSettings(!showColorSettings)}
          className="w-full text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
        >
          <div className="flex items-center gap-2">
            {showColorSettings ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
            <Settings className="h-4 w-4" />
            <span>颜色设置</span>
            {!showColorSettings && (
              <Badge variant="secondary" className="text-xs ml-auto">
                点击查看
              </Badge>
            )}
          </div>
        </Button>

        {showColorSettings && (
          <Card className="mt-3 card-modern">
            <CardContent className="py-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
                  <Label htmlFor="auto-sync" className="cursor-pointer text-sm">
                    手动同步
                  </Label>
                  <Switch id="auto-sync" checked={autoSync} onCheckedChange={setAutoSync} />
                  <Label htmlFor="auto-sync" className="cursor-pointer text-sm text-blue-600">
                    自动同步
                  </Label>
                </div>
                <div className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
                  <Label htmlFor="show-preview" className="cursor-pointer text-sm">
                    隐藏预览
                  </Label>
                  <Switch id="show-preview" checked={showPreview} onCheckedChange={setShowPreview} />
                  <Label htmlFor="show-preview" className="cursor-pointer text-sm text-green-600">
                    显示预览
                  </Label>
                </div>
                <div className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
                  <Label htmlFor="name-detection" className="cursor-pointer text-sm">
                    关闭名称
                  </Label>
                  <Switch id="name-detection" checked={enableNameDetection} onCheckedChange={setEnableNameDetection} />
                  <Label htmlFor="name-detection" className="cursor-pointer text-sm text-purple-600">
                    启用名称
                  </Label>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧：颜色预览和选择器 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 颜色预览 */}
          {showPreview && (
            <Card className="card-modern">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Eye className="h-4 w-4 text-pink-600" />
                  颜色预览
                  {autoSync && (
                    <Badge variant="secondary" className="text-xs">
                      <Zap className="h-3 w-3 mr-1" />
                      自动同步
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* 大颜色预览 */}
                  <div className="relative">
                    <div
                      className="w-full h-32 rounded-2xl shadow-lg border-4 border-white dark:border-gray-800 transition-all duration-300"
                      style={{ backgroundColor: color }}
                    />
                    <div className="absolute top-2 right-2 bg-white/90 dark:bg-gray-800/90 rounded-lg px-2 py-1 text-xs font-mono">
                      {color.toUpperCase()}
                    </div>
                  </div>

                  {/* 颜色选择器 */}
                  <div className="flex items-center gap-4">
                    <Label className="text-sm font-medium">颜色选择:</Label>
                    <div className="relative flex-1">
                      <input
                        type="color"
                        value={color}
                        onChange={handleColorChange}
                        className="w-full h-12 cursor-pointer rounded-lg border-2 border-gray-200 dark:border-gray-700"
                      />
                      <Pipette className="absolute right-3 top-3 h-6 w-6 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 调色板 */}
          <Card className="card-modern">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Palette className="h-4 w-4 text-purple-600" />
                常用颜色
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-6 md:grid-cols-9 gap-3">
                {COMMON_COLORS.map((paletteColor) => (
                  <TooltipProvider key={paletteColor}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          className={`w-10 h-10 rounded-xl border-3 transition-all hover:scale-110 hover:shadow-lg ${
                            paletteColor === color 
                              ? "border-gray-800 dark:border-white ring-2 ring-blue-500" 
                              : "border-gray-200 dark:border-gray-700"
                          }`}
                          style={{ backgroundColor: paletteColor }}
                          onClick={() => handleSwatchClick(paletteColor)}
                        />
                      </TooltipTrigger>
                      <TooltipContent>
                        {paletteColor.toUpperCase()}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 最近使用的颜色 */}
          {recentColors.length > 0 && (
            <Card className="card-modern">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-orange-600" />
                  最近使用
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  {recentColors.map((recentColor, index) => (
                    <TooltipProvider key={`${recentColor}-${index}`}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            className={`w-10 h-10 rounded-xl border-3 transition-all hover:scale-110 hover:shadow-lg ${
                              recentColor === color 
                                ? "border-gray-800 dark:border-white ring-2 ring-blue-500" 
                                : "border-gray-200 dark:border-gray-700"
                            }`}
                            style={{ backgroundColor: recentColor }}
                            onClick={() => handleSwatchClick(recentColor)}
                          />
                        </TooltipTrigger>
                        <TooltipContent>
                          {recentColor.toUpperCase()}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

        </div>

        {/* 右侧：颜色格式 */}
        <div className="space-y-6">
          <Card className="card-modern">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Copy className="h-4 w-4 text-blue-600" />
                颜色格式
                {enableNameDetection && (
                  <Badge variant="secondary" className="text-xs">
                    <Eye className="h-3 w-3 mr-1" />
                    名称检测
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {formats.map((format, index) => (
                  <div key={format.label} className="space-y-2">
                    <Label className="text-sm font-medium uppercase text-gray-600 dark:text-gray-400">
                      {format.label}
                    </Label>
                    <div className="relative">
                      <Input
                        value={format.value}
                        onChange={(e) => handleFormatChange(e.target.value, index)}
                        className="pr-16 font-mono text-sm"
                        placeholder={`输入 ${format.label.toUpperCase()} 格式...`}
                      />
                      <div className="absolute right-0 top-0 h-full flex items-center space-x-1 pr-2">
                        {format.value && (
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleClear(index)}>
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => handleCopy(index)}
                                disabled={!format.value}
                              >
                                {format.copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {format.copied ? "已复制" : "复制"}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>
                    {format.copied && (
                      <div className="text-xs text-green-600 flex items-center gap-1">
                        <Check className="h-3 w-3" />
                        已复制到剪贴板
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
