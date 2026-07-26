// 用 sharp 从内联 SVG 生成 PWA / favicon 图标
// 运行: node scripts/generate-icons.mjs
import sharp from "sharp"
import { mkdir } from "node:fs/promises"
import path from "node:path"

const GREEN = "#4A8135"
const GREEN_DARK = "#3A6829"
const SURFACE = "#FDFDF5"

// 2×2 圆角方块代表“工具集合”，右下角为强调色
function glyph(cx, cy, unit) {
  const gap = unit * 0.12
  const size = unit * 0.44
  const r = size * 0.28
  const x0 = cx - size - gap / 2
  const x1 = cx + gap / 2
  const y0 = cy - size - gap / 2
  const y1 = cy + gap / 2
  return `
    <rect x="${x0}" y="${y0}" width="${size}" height="${size}" rx="${r}" fill="${SURFACE}" />
    <rect x="${x1}" y="${y0}" width="${size}" height="${size}" rx="${r}" fill="${SURFACE}" />
    <rect x="${x0}" y="${y1}" width="${size}" height="${size}" rx="${r}" fill="${SURFACE}" />
    <rect x="${x1}" y="${y1}" width="${size}" height="${size}" rx="${r}" fill="${SURFACE}" opacity="0.72" />
  `
}

function standardIcon(size) {
  const r = size * 0.225
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${GREEN}" />
        <stop offset="1" stop-color="${GREEN_DARK}" />
      </linearGradient>
    </defs>
    <rect width="${size}" height="${size}" rx="${r}" fill="url(#bg)" />
    ${glyph(size / 2, size / 2, size * 0.58)}
  </svg>`
}

// maskable：背景铺满整个画布，图形保持在中心 80% 安全区内
function maskableIcon(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${GREEN}" />
        <stop offset="1" stop-color="${GREEN_DARK}" />
      </linearGradient>
    </defs>
    <rect width="${size}" height="${size}" fill="url(#bg)" />
    ${glyph(size / 2, size / 2, size * 0.52)}
  </svg>`
}

async function render(svgText, outPath, size) {
  await sharp(Buffer.from(svgText)).resize(size, size).png().toFile(outPath)
  console.log("written", outPath)
}

const root = path.resolve(import.meta.dirname, "..")
await mkdir(path.join(root, "public", "icons"), { recursive: true })

await render(standardIcon(512), path.join(root, "public", "icons", "icon-192.png"), 192)
await render(standardIcon(512), path.join(root, "public", "icons", "icon-512.png"), 512)
await render(maskableIcon(512), path.join(root, "public", "icons", "icon-maskable-192.png"), 192)
await render(maskableIcon(512), path.join(root, "public", "icons", "icon-maskable-512.png"), 512)
await render(standardIcon(512), path.join(root, "app", "icon.png"), 64)
await render(standardIcon(512), path.join(root, "app", "apple-icon.png"), 180)
