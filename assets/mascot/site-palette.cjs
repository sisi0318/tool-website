// Recolor SVG paint values only; all traced paths and their ordering stay intact.
// Matches the site's cream surface, matcha primary and deep green ink colors.
function toHsl(red, green, blue) {
  const maximum = Math.max(red, green, blue)
  const minimum = Math.min(red, green, blue)
  const delta = maximum - minimum
  const lightness = (maximum + minimum) / 2
  if (!delta) return [0, 0, lightness]
  const saturation = delta / (1 - Math.abs(2 * lightness - 1))
  let hue = maximum === red ? ((green - blue) / delta) % 6
    : maximum === green ? (blue - red) / delta + 2 : (red - green) / delta + 4
  hue = (hue * 60 + 360) % 360
  return [hue, saturation, lightness]
}

function fromHsl(hue, saturation, lightness) {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation
  const part = chroma * (1 - Math.abs((hue / 60) % 2 - 1))
  const offset = lightness - chroma / 2
  const channels = hue < 60 ? [chroma, part, 0] : hue < 120 ? [part, chroma, 0]
    : hue < 180 ? [0, chroma, part] : hue < 240 ? [0, part, chroma]
      : hue < 300 ? [part, 0, chroma] : [chroma, 0, part]
  return `#${channels.map(value => Math.round((value + offset) * 255).toString(16).padStart(2, '0')).join('')}`
}

function mapColor(hex) {
  const channels = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255)
  const [hue, saturation, lightness] = toHsl(...channels)
  const range = Math.max(...channels) - Math.min(...channels)
  // Keep the peach skin, blush and small lemon accents. Warm only cool whites.
  if (range < 0.075 && lightness > 0.78 && ((hue >= 80 && hue <= 265) || range < 0.008)) {
    return fromHsl(65, 0.12 + Math.max(0, lightness - 0.9) * 4, lightness)
  }
  if (hue >= 130 && hue <= 265) {
    const ink = Math.max(0, Math.min(1, (hue - 170) / 60))
    return fromHsl(112 + 20 * ink, saturation * (0.62 - 0.04 * ink), Math.max(0, lightness - (lightness < 0.5 ? 0.025 : 0.035)))
  }
  return hex
}

function applySitePalette(svg) {
  return svg.replace(/\b(fill|stroke)="(#[a-f\d]{6})"/gi,
    (_, attribute, color) => `${attribute}="${mapColor(color)}"`)
}

module.exports = { applySitePalette }
