// Run from the repository root; see README.md for the isolated tooling install.
const fs = require('node:fs')
const path = require('node:path')
const zlib = require('node:zlib')
const sharp = require('sharp')
const vtracer = require('../../node_modules/.cache/mascot-vector/node_modules/@visioncortex/vtracer')
const settings = require('./vector-settings.json')
const { applySitePalette } = require('./site-palette.cjs')

async function main() {
  const source = path.join(__dirname, process.argv[2] || 'reference-v4.png')
  const sourceMetadata = await sharp(source).metadata()
  const { data, info } = await sharp(source)
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true })

  // Ignore almost transparent fringes; keep RGB untouched. Remove only tiny
  // disconnected alpha islands, never color details inside the character.
  const count = info.width * info.height
  const seen = new Uint8Array(count)
  const queue = new Uint32Array(count)

  // The loose ink drawing deliberately has gaps in its outlines. Close those
  // gaps in a temporary segmentation mask, then undo the expansion after flood
  // filling. Original RGB strokes and fills are never thickened or repainted.
  if (!sourceMetadata.hasAlpha) {
    const neutral = new Uint8Array(count)
    const ink = Buffer.alloc(count)
    for (let pixel = 0; pixel < count; pixel++) {
      const offset = pixel * 4
      const minimum = Math.min(data[offset], data[offset + 1], data[offset + 2])
      const maximum = Math.max(data[offset], data[offset + 1], data[offset + 2])
      neutral[pixel] = minimum >= 224 && maximum - minimum <= 18 ? 1 : 0
      ink[pixel] = neutral[pixel] ? 0 : 255
    }
    const rawMask = { width: info.width, height: info.height, channels: 1 }
    const buildSilhouette = async (gapRadius) => {
      const seen = new Uint8Array(count)
      // Sharp's morphology uses dark foreground: erode expands our white mask.
      const barrier = await sharp(ink, { raw: rawMask })
        .erode(gapRadius).greyscale().raw().toBuffer()
      let head = 0
      let tail = 0
      const addBackground = (pixel) => {
        if (pixel < 0 || pixel >= count || seen[pixel] || barrier[pixel]) return
        seen[pixel] = 1
        queue[tail++] = pixel
      }
      for (let x = 0; x < info.width; x++) {
        addBackground(x)
        addBackground((info.height - 1) * info.width + x)
      }
      for (let y = 0; y < info.height; y++) {
        addBackground(y * info.width)
        addBackground(y * info.width + info.width - 1)
      }
      // Keep the intentional open space between V4's raised hand and hair.
      // Closing small ink gaps can otherwise enclose this background pocket.
      if (path.basename(source) === 'reference-v4.png') {
        addBackground(700 * info.width + 350)
      }
      while (head < tail) {
        const current = queue[head++]
        const x = current % info.width
        if (x) addBackground(current - 1)
        if (x < info.width - 1) addBackground(current + 1)
        addBackground(current - info.width)
        addBackground(current + info.width)
      }
      const filled = Buffer.alloc(count)
      for (let pixel = 0; pixel < count; pixel++) filled[pixel] = seen[pixel] ? 0 : 255
      return sharp(filled, { raw: rawMask })
        .dilate(gapRadius).greyscale().raw().toBuffer()
    }
    const silhouette = await buildSilhouette(Math.round(info.width * 0.005))
    // Wider intentional breaks occur only in V4's lower-right sleeve folds.
    // Repair that area without filling the open spaces around the hair/stylus.
    const sleeve = path.basename(source) === 'reference-v4.png'
      ? await buildSilhouette(Math.round(info.width * 0.008)) : null
    for (let pixel = 0; pixel < count; pixel++) {
      const sleeveArea = pixel % info.width > info.width * 0.7 && pixel / info.width > info.height * 0.68
      if (neutral[pixel] && !silhouette[pixel] && !(sleeveArea && sleeve?.[pixel])) data[pixel * 4 + 3] = 0
    }
    seen.fill(0)
  }

  for (let i = 0; i < count; i++) data[i * 4 + 3] = data[i * 4 + 3] >= 128 ? 255 : 0
  for (let seed = 0; seed < count; seed++) {
    if (seen[seed] || !data[seed * 4 + 3]) continue
    let head = 0
    let tail = 1
    queue[0] = seed
    seen[seed] = 1
    while (head < tail) {
      const current = queue[head++]
      const x = current % info.width
      const candidates = [
        ...(x ? [current - 1] : []),
        ...(x < info.width - 1 ? [current + 1] : []),
        current - info.width, current + info.width,
      ]
      for (const next of candidates) {
        if (next < 0 || next >= count || seen[next] || !data[next * 4 + 3]) continue
        seen[next] = 1
        queue[tail++] = next
      }
    }
    if (tail < 100) {
      for (let i = 0; i < tail; i++) data[queue[i] * 4 + 3] = 0
    }
  }

  let svg = vtracer.convertPixels(data, info.width, info.height, settings)
  const padding = 48
  svg = svg.replace(/<svg\b[^>]*>/,
    `<svg xmlns="http://www.w3.org/2000/svg" width="560" height="560" viewBox="${-padding} ${-padding} ${info.width + padding * 2} ${info.height + padding * 2}" role="img" aria-labelledby="mascot-title mascot-description">\n` +
    '<title id="mascot-title">小栈 · 工具站小助手</title>\n' +
    '<desc id="mascot-description">原创工具站小助手小栈：奶油白蓬松短发、芯片发夹和抹茶绿连帽外套，抱着终端平板并举起触控笔，以深森林绿手绘线稿和平涂绘制。</desc>')
  svg = applySitePalette(svg)
  if (/<image\b|data:image|base64|<script\b/i.test(svg)) throw new Error('Expected a self-contained path-only SVG')
  fs.writeFileSync(path.join(__dirname, '../../public/mascot.svg'), svg)
  console.log(JSON.stringify({
    bytes: Buffer.byteLength(svg),
    gzipBytes: zlib.gzipSync(svg).length,
    paths: (svg.match(/<path\b/g) || []).length,
  }))
}

main().catch(error => { console.error(error); process.exitCode = 1 })
