"use client"

import { copyTextToClipboard } from "@/lib/clipboard"

import type React from "react"

import { useState, useEffect, useRef, useMemo } from "react"
import { useTranslations } from "@/hooks/use-translations"
import { parseColorInput, rgbToLch, type ColorInputFormat } from "@/lib/color-conversion"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Check, Copy, X, Settings, ChevronUp, ChevronDown, Palette, Zap, RefreshCw, Eye, Pipette } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import debounce from "debounce"
import { ColorPicker } from "@/components/ui/color-picker"

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
  label: ColorInputFormat | "name"
  value: string
}

/** 把某个格式框里的文字解析成 #rrggbb；名称走本页的 CSS 颜色名表 */
function parseFormatValue(label: ColorFormat["label"], value: string): string | null {
  if (label === "name") return NAME_TO_HEX[value.trim().toLowerCase()] ?? null
  return parseColorInput(label, value)
}

export default function ColorPickerPage() {
  const t = useTranslations("color")

  // Base state
  const [showColorSettings, setShowColorSettings] = useState(false)
  const [autoSync, setAutoSync] = useState(true)
  const [showPreview, setShowPreview] = useState(true)
  const [enableNameDetection, setEnableNameDetection] = useState(true)

  const [color, setColor] = useState("#106a2f")
  const [formats, setFormats] = useState<ColorFormat[]>([
    { label: "hex", value: "#106a2f" },
    { label: "rgb", value: "rgb(16, 106, 47)" },
    { label: "hsl", value: "hsl(141, 74%, 24%)" },
    { label: "hwb", value: "hwb(141 6% 58%)" },
    { label: "lch", value: "lch(38.93% 44.58 145.3)" },
    { label: "cmyk", value: "device-cmyk(85% 0% 56% 58%)" },
    { label: "name", value: "forestgreen" },
  ])
  const [copiedLabel, setCopiedLabel] = useState<ColorFormat["label"] | null>(null)
  const [recentColors, setRecentColors] = useState<string[]>([])

  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // 用户正在某个格式框里输入时，重算各格式不应把这一框改写成规范写法（光标会跳到末尾）
  const editedFormatRef = useRef<ColorFormat | null>(null)

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
    // 防抖函数只建一次；updateAllFormats 每次渲染都是新函数，加进依赖会让防抖失效
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      debouncedUpdateFormats.clear()
    }
  }, [color, debouncedUpdateFormats, debouncedAddToRecent])

  // Clean up timeouts on unmount
  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
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

    const next: ColorFormat[] = [
      { label: "hex", value: hexColor },
      { label: "rgb", value: `rgb(${r}, ${g}, ${b})` },
      { label: "hsl", value: `hsl(${h}, ${s}%, ${l}%)` },
      { label: "hwb", value: `hwb(${hw} ${ww}% ${bw}%)` },
      { label: "lch", value: `lch(${lc}% ${cc} ${hc})` },
      { label: "cmyk", value: `device-cmyk(${cy}% ${my}% ${yy}% ${ky}%)` },
      { label: "name", value: name },
    ]
    // 颜色正是从某个格式框解析来的：保留用户在那一框里的原文
    const edited = editedFormatRef.current
    editedFormatRef.current = null
    setFormats(
      edited && parseFormatValue(edited.label, edited.value) === hexColor
        ? next.map((format) => (format.label === edited.label ? edited : format))
        : next,
    )
  }

  // Handle color input change
  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setColor(e.target.value)
  }

  // Handle format input change
  const handleFormatChange = (value: string, label: ColorFormat["label"]) => {
    setFormats((previous) => previous.map((format) => (format.label === label ? { label, value } : format)))

    const parsed = parseFormatValue(label, value)
    if (parsed && parsed !== color) {
      editedFormatRef.current = { label, value }
      setColor(parsed)
    }
  }

  // Handle clear button click
  const handleClear = (label: ColorFormat["label"]) => {
    setFormats((previous) => previous.map((format) => (format.label === label ? { label, value: "" } : format)))
  }

  // Handle copy button click
  const handleCopy = (label: ColorFormat["label"], value: string) => {
    if (!value) return

    void copyTextToClipboard(value).then((success) => {
      if (!success) return
      setCopiedLabel(label)
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
      copyTimeoutRef.current = setTimeout(() => {
        setCopiedLabel((current) => (current === label ? null : current))
      }, 2000)
    })
  }

  // Handle color swatch click
  const handleSwatchClick = (swatchColor: string) => {
    setColor(swatchColor)
  }

  return (
    <div className="container mx-auto px-4 py-4 max-w-6xl">
      {/* Page title */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-[var(--md-sys-color-on-surface)] mb-4 flex items-center justify-center gap-2">
          <Palette className="h-8 w-8 text-[var(--md-sys-color-primary)]" />
          {t("title")}
        </h1>
      </div>

      {/* Collapsible color settings */}
      <div className="mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowColorSettings(!showColorSettings)}
          className="w-full text-sm text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-surface)]"
        >
          <div className="flex items-center gap-2">
            {showColorSettings ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
            <Settings className="h-4 w-4" />
            <span>{t("colorSettings")}</span>
            {!showColorSettings && (
              <Badge variant="secondary" className="text-xs ml-auto">
                {t("clickToView")}
              </Badge>
            )}
          </div>
        </Button>

        {showColorSettings && (
          <Card className="mt-3 card-modern">
            <CardContent className="py-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center space-x-2 bg-[var(--md-sys-color-surface-container-low)] p-3 rounded-lg">
                  <Label htmlFor="auto-sync" className="cursor-pointer text-sm">
                    {t("manualSync")}
                  </Label>
                  <Switch id="auto-sync" checked={autoSync} onCheckedChange={setAutoSync} />
                  <Label htmlFor="auto-sync" className="cursor-pointer text-sm text-[var(--md-sys-color-primary)]">
                    {t("autoSync")}
                  </Label>
                </div>
                <div className="flex items-center space-x-2 bg-[var(--md-sys-color-surface-container-low)] p-3 rounded-lg">
                  <Label htmlFor="show-preview" className="cursor-pointer text-sm">
                    {t("hidePreview")}
                  </Label>
                  <Switch id="show-preview" checked={showPreview} onCheckedChange={setShowPreview} />
                  <Label htmlFor="show-preview" className="cursor-pointer text-sm text-[var(--md-sys-color-primary)]">
                    {t("showPreview")}
                  </Label>
                </div>
                <div className="flex items-center space-x-2 bg-[var(--md-sys-color-surface-container-low)] p-3 rounded-lg">
                  <Label htmlFor="name-detection" className="cursor-pointer text-sm">
                    {t("disableName")}
                  </Label>
                  <Switch id="name-detection" checked={enableNameDetection} onCheckedChange={setEnableNameDetection} />
                  <Label htmlFor="name-detection" className="cursor-pointer text-sm text-[var(--md-sys-color-primary)]">
                    {t("enableName")}
                  </Label>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: color preview and picker */}
        <div className="lg:col-span-2 space-y-6">
          {/* Color preview */}
          {showPreview && (
            <Card className="card-modern">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Eye className="h-4 w-4 text-[var(--md-sys-color-primary)]" />
                  {t("colorPreview")}
                  {autoSync && (
                    <Badge variant="secondary" className="text-xs">
                      <Zap className="h-3 w-3 mr-1" />
                      {t("autoSync")}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Large color preview */}
                  <div className="relative">
                    <div
                      className="w-full h-32 rounded-2xl shadow-lg border-4 border-[var(--md-sys-color-surface)] transition-all duration-300"
                      style={{ backgroundColor: color }}
                    />
                    <div className="absolute top-2 right-2 bg-[var(--md-sys-color-surface)] text-[var(--md-sys-color-on-surface)] rounded-lg px-2 py-1 text-xs font-mono">
                      {color.toUpperCase()}
                    </div>
                  </div>

                  {/* Color picker */}
                  <div className="flex flex-col gap-4">
                    <Label className="text-sm font-medium">{t("selectColor")}</Label>
                    <div className="relative flex-1">
                      <ColorPicker
                        color={color}
                        onChange={setColor}
                        width={300}
                        height={200}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Palette */}
          <Card className="card-modern">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Palette className="h-4 w-4 text-[var(--md-sys-color-primary)]" />
                {t("commonColors")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-6 md:grid-cols-9 gap-3">
                {COMMON_COLORS.map((paletteColor) => (
                  <TooltipProvider key={paletteColor}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          className={`w-10 h-10 rounded-xl border-3 transition-all hover:scale-110 hover:shadow-lg ${paletteColor === color
                            ? "border-[var(--md-sys-color-on-surface)] ring-2 ring-[var(--md-sys-color-primary)]"
                            : "border-[var(--md-sys-color-outline-variant)]"
                            }`}
                          style={{ backgroundColor: paletteColor }}
                          aria-label={paletteColor}
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

          {/* Recently used colors */}
          {recentColors.length > 0 && (
            <Card className="card-modern">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-[var(--md-sys-color-primary)]" />
                  {t("recentColors")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  {recentColors.map((recentColor, index) => (
                    <TooltipProvider key={`${recentColor}-${index}`}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            className={`w-10 h-10 rounded-xl border-3 transition-all hover:scale-110 hover:shadow-lg ${recentColor === color
                              ? "border-[var(--md-sys-color-on-surface)] ring-2 ring-[var(--md-sys-color-primary)]"
                              : "border-[var(--md-sys-color-outline-variant)]"
                              }`}
                            style={{ backgroundColor: recentColor }}
                            aria-label={recentColor}
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

        {/* Right: color formats */}
        <div className="space-y-6">
          <Card className="card-modern">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Copy className="h-4 w-4 text-[var(--md-sys-color-primary)]" />
                {t("colorFormats")}
                {enableNameDetection && (
                  <Badge variant="secondary" className="text-xs">
                    <Eye className="h-3 w-3 mr-1" />
                    {t("nameDetection")}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {formats.map((format) => {
                  const inputId = `color-format-${format.label}`
                  const invalid = format.value.trim() !== "" && parseFormatValue(format.label, format.value) === null
                  const copied = copiedLabel === format.label
                  return (
                  <div key={format.label} className="space-y-2">
                    <Label htmlFor={inputId} className="text-sm font-medium uppercase text-[var(--md-sys-color-on-surface-variant)]">
                      {format.label}
                    </Label>
                    <div className="relative">
                      <Input
                        id={inputId}
                        value={format.value}
                        onChange={(e) => handleFormatChange(e.target.value, format.label)}
                        aria-invalid={invalid || undefined}
                        aria-describedby={invalid ? `${inputId}-error` : undefined}
                        className="pr-16 font-mono text-sm"
                        placeholder={t("formatPlaceholder").replace("{format}", format.label.toUpperCase())}
                      />
                      <div className="absolute right-0 top-0 h-full flex items-center space-x-1 pr-2">
                        {format.value && (
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleClear(format.label)} aria-label={t("clearValue")}>
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
                                onClick={() => handleCopy(format.label, format.value)}
                                disabled={!format.value}
                                aria-label={copied ? t("copied") : t("copy")}
                              >
                                {copied ? <Check className="h-3 w-3 text-[var(--md-sys-color-primary)]" /> : <Copy className="h-3 w-3" />}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {copied ? t("copied") : t("copy")}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>
                    {invalid && (
                      <p id={`${inputId}-error`} className="text-xs text-[var(--md-sys-color-error)]">
                        {t("invalidFormat").replace("{format}", format.label.toUpperCase())}
                      </p>
                    )}
                    {copied && (
                      <div className="text-xs text-[var(--md-sys-color-primary)] flex items-center gap-1">
                        <Check className="h-3 w-3" />
                        {t("copiedToClipboard")}
                      </div>
                    )}
                  </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
