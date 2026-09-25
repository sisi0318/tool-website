function srgbChannelToLinear(channel: number): number {
  const normalized = Math.min(255, Math.max(0, channel)) / 255
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4
}

function labTransform(value: number): number {
  const epsilon = 216 / 24389
  const kappa = 24389 / 27
  return value > epsilon ? Math.cbrt(value) : (kappa * value + 16) / 116
}

/** Convert sRGB bytes to CSS Color 4 CIELCH (D50). */
export function rgbToLch(red: number, green: number, blue: number): [number, number, number] {
  const r = srgbChannelToLinear(red)
  const g = srgbChannelToLinear(green)
  const b = srgbChannelToLinear(blue)

  // Linear sRGB to XYZ D65.
  const x65 = r * 0.4124564 + g * 0.3575761 + b * 0.1804375
  const y65 = r * 0.2126729 + g * 0.7151522 + b * 0.0721750
  const z65 = r * 0.0193339 + g * 0.1191920 + b * 0.9503041

  // Bradford-adapt XYZ D65 to D50, as required by CSS lch().
  const x50 = x65 * 1.0479298 + y65 * 0.0229468 - z65 * 0.0501922
  const y50 = x65 * 0.0296278 + y65 * 0.9904345 - z65 * 0.0170738
  const z50 = x65 * -0.0092430 + y65 * 0.0150552 + z65 * 0.7518743

  const fx = labTransform(x50 / 0.96422)
  const fy = labTransform(y50)
  const fz = labTransform(z50 / 0.82521)
  const lightness = 116 * fy - 16
  const a = 500 * (fx - fy)
  const labB = 200 * (fy - fz)
  const chroma = Math.hypot(a, labB)
  const hue = (Math.atan2(labB, a) * 180 / Math.PI + 360) % 360

  return [
    Number(lightness.toFixed(2)),
    Number(chroma.toFixed(2)),
    Number(hue.toFixed(1)),
  ]
}

function linearToSrgbChannel(value: number): number {
  const encoded = value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055
  return Math.min(255, Math.max(0, Math.round(encoded * 255)))
}

/** Inverse of rgbToLch; colors outside sRGB are clipped per channel. */
export function lchToRgb(lightness: number, chroma: number, hue: number): [number, number, number] {
  const epsilon = 216 / 24389
  const kappa = 24389 / 27
  const radians = hue * Math.PI / 180
  const fy = (lightness + 16) / 116
  const fx = fy + chroma * Math.cos(radians) / 500
  const fz = fy - chroma * Math.sin(radians) / 200
  const x50 = (fx ** 3 > epsilon ? fx ** 3 : (116 * fx - 16) / kappa) * 0.96422
  const y50 = lightness > kappa * epsilon ? fy ** 3 : lightness / kappa
  const z50 = (fz ** 3 > epsilon ? fz ** 3 : (116 * fz - 16) / kappa) * 0.82521

  // Bradford D50 back to D65, then XYZ to linear sRGB (inverses of the matrices above).
  const x65 = x50 * 0.9554734 - y50 * 0.0230985 + z50 * 0.0632593
  const y65 = x50 * -0.0283697 + y50 * 1.0099954 + z50 * 0.0210414
  const z65 = x50 * 0.0123140 - y50 * 0.0205077 + z50 * 1.3303659

  return [
    linearToSrgbChannel(x65 * 3.2404542 - y65 * 1.5371385 - z65 * 0.4985314),
    linearToSrgbChannel(x65 * -0.9692660 + y65 * 1.8760108 + z65 * 0.0415560),
    linearToSrgbChannel(x65 * 0.0556434 - y65 * 0.2040259 + z65 * 1.0572252),
  ]
}

export type ColorInputFormat = "hex" | "rgb" | "hsl" | "hwb" | "lch" | "cmyk"

const FUNCTION_NAMES: Record<Exclude<ColorInputFormat, "hex">, readonly string[]> = {
  rgb: ["rgb", "rgba"],
  hsl: ["hsl", "hsla"],
  hwb: ["hwb"],
  lch: ["lch"],
  cmyk: ["device-cmyk", "cmyk"],
}

interface CssNumber {
  value: number
  unit: "" | "%" | "deg"
}

function parseCssNumber(token: string): CssNumber | null {
  const match = /^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(%|deg)?$/i.exec(token)
  if (!match) return null
  const value = Number(match[1])
  return Number.isFinite(value) ? { value, unit: (match[2]?.toLowerCase() ?? "") as CssNumber["unit"] } : null
}

/**
 * Split `rgb(16, 106, 47)`, `rgb(16 106 47 / 50%)` or a bare `16 106 47` into channel
 * tokens. Alpha is accepted after `/` (or as a fourth comma argument where legacy CSS
 * allows it) but ignored: the picker works in opaque `#rrggbb`.
 */
function splitColorFunction(format: Exclude<ColorInputFormat, "hex">, input: string): CssNumber[] | null {
  const trimmed = input.trim()
  let body = trimmed
  if (trimmed.includes("(")) {
    const match = /^([a-z-]+)\(([^()]*)\)$/i.exec(trimmed)
    if (!match || !FUNCTION_NAMES[format].includes(match[1].toLowerCase())) return null
    body = match[2]
  }

  const [channels, alpha, extra] = body.split("/")
  if (extra !== undefined || (alpha !== undefined && !parseCssNumber(alpha.trim()))) return null

  const tokens = channels.includes(",")
    ? channels.split(",").map((token) => token.trim())
    : channels.trim().split(/\s+/)
  const expected = format === "cmyk" ? 4 : 3
  const legacyAlpha = alpha === undefined && channels.includes(",") && (format === "rgb" || format === "hsl")
  if (tokens.length !== expected && !(legacyAlpha && tokens.length === expected + 1)) return null

  const numbers = tokens.map(parseCssNumber)
  if (numbers.some((number) => number === null)) return null
  return (numbers as CssNumber[]).slice(0, expected)
}

function toHexColor(red: number, green: number, blue: number): string {
  return `#${[red, green, blue]
    .map((channel) => Math.min(255, Math.max(0, Math.round(channel))).toString(16).padStart(2, "0"))
    .join("")}`
}

function hueDegrees(number: CssNumber): number | null {
  if (number.unit === "%") return null
  return ((number.value % 360) + 360) % 360
}

/** A percentage channel; bare numbers are read as percentages, as CSS Color 4 allows for hsl/hwb. */
function percent(number: CssNumber): number | null {
  if (number.unit === "deg" || number.value < 0 || number.value > 100) return null
  return number.value / 100
}

function hslToRgb(hue: number, saturation: number, lightness: number): [number, number, number] {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation
  const channel = (offset: number) => {
    const k = (offset + hue / 30) % 12
    return 255 * (lightness - chroma / 2 * Math.max(-1, Math.min(k - 3, 9 - k, 1)))
  }
  return [channel(0), channel(8), channel(4)]
}

/**
 * Parse a color typed into one of the picker's format fields.
 * Returns `#rrggbb`, or null when the text is not a complete, in-range value.
 */
export function parseColorInput(format: ColorInputFormat, input: string): string | null {
  if (format === "hex") {
    const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(input.trim())
    if (!match) return null
    const digits = match[1].length === 3 ? [...match[1]].map((digit) => digit + digit).join("") : match[1]
    return `#${digits.toLowerCase()}`
  }

  const channels = splitColorFunction(format, input)
  if (!channels) return null

  switch (format) {
    case "rgb": {
      const values = channels.map((number) => {
        if (number.unit === "deg") return null
        const value = number.unit === "%" ? number.value * 2.55 : number.value
        return value >= 0 && value <= 255 ? value : null
      })
      if (values.some((value) => value === null)) return null
      const [red, green, blue] = values as number[]
      return toHexColor(red, green, blue)
    }
    case "hsl": {
      const hue = hueDegrees(channels[0])
      const saturation = percent(channels[1])
      const lightness = percent(channels[2])
      if (hue === null || saturation === null || lightness === null) return null
      return toHexColor(...hslToRgb(hue, saturation, lightness))
    }
    case "hwb": {
      const hue = hueDegrees(channels[0])
      const white = percent(channels[1])
      const black = percent(channels[2])
      if (hue === null || white === null || black === null) return null
      if (white + black >= 1) {
        const gray = 255 * white / (white + black)
        return toHexColor(gray, gray, gray)
      }
      const scale = 1 - white - black
      const [red, green, blue] = hslToRgb(hue, 1, 0.5)
      return toHexColor(red * scale + 255 * white, green * scale + 255 * white, blue * scale + 255 * white)
    }
    case "lch": {
      const [lightnessToken, chromaToken, hueToken] = channels
      if (lightnessToken.unit === "deg" || chromaToken.unit === "deg") return null
      // CSS maps lch() percentages: 100% lightness is 100, 100% chroma is 150.
      const lightness = lightnessToken.value
      const chroma = chromaToken.unit === "%" ? chromaToken.value * 1.5 : chromaToken.value
      const hue = hueDegrees(hueToken)
      if (hue === null || lightness < 0 || lightness > 100 || chroma < 0) return null
      return toHexColor(...lchToRgb(lightness, chroma, hue))
    }
    case "cmyk": {
      if (channels.some((number) => number.unit === "deg")) return null
      // device-cmyk() takes 0–1 numbers or percentages. Bare numbers above 1 are
      // almost always percentages with the sign left off, so read the whole value that way.
      const bareAsPercent = channels.some((number) => number.unit === "" && number.value > 1)
      const fractions = channels.map((number) =>
        number.unit === "%" || bareAsPercent ? number.value / 100 : number.value,
      )
      if (fractions.some((value) => value < 0 || value > 1)) return null
      const [cyan, magenta, yellow, key] = fractions
      return toHexColor(
        255 * (1 - cyan) * (1 - key),
        255 * (1 - magenta) * (1 - key),
        255 * (1 - yellow) * (1 - key),
      )
    }
  }
}
