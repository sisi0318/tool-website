export interface ImageAdjustOptions { brightness: number; contrast: number; saturation: number; grayscale: boolean }
export const IMAGE_ADJUST_LIMITS = { bytes: 20 * 1024 * 1024, pixels: 20_000_000, side: 32768, outputBytes: 64 * 1024 * 1024, timeout: 30_000 }
export function imageAdjustOptions(input: ImageAdjustOptions): ImageAdjustOptions {
  if ([input.brightness, input.contrast, input.saturation].some(value => !Number.isFinite(value) || value < 0 || value > 200) || typeof input.grayscale !== "boolean") throw new Error("Image adjustments must be 0–200 and grayscale must be boolean")
  return { ...input }
}
/** Brightness, contrast, saturation, then optional grayscale. Alpha is unchanged. */
export function adjustImagePixels(data: Uint8ClampedArray, input: ImageAdjustOptions): void {
  const options = imageAdjustOptions(input), brightness = options.brightness / 100, contrast = options.contrast / 100, saturation = options.saturation / 100
  const clamp = (value: number) => Math.min(255, Math.max(0, value))
  for (let p = 0; p < data.length; p += 4) {
    let r = clamp((clamp(data[p] * brightness) - 127.5) * contrast + 127.5), g = clamp((clamp(data[p + 1] * brightness) - 127.5) * contrast + 127.5), b = clamp((clamp(data[p + 2] * brightness) - 127.5) * contrast + 127.5)
    const luminance = r * 0.2126 + g * 0.7152 + b * 0.0722
    r = clamp(luminance + (r - luminance) * saturation); g = clamp(luminance + (g - luminance) * saturation); b = clamp(luminance + (b - luminance) * saturation)
    if (options.grayscale) r = g = b = r * 0.2126 + g * 0.7152 + b * 0.0722
    data[p] = r; data[p + 1] = g; data[p + 2] = b
  }
}
