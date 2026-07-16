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
