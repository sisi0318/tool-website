// Run from the repository root; see README.md for the isolated tooling install.
const fs = require('node:fs')
const path = require('node:path')
const zlib = require('node:zlib')
const sharp = require('sharp')
const vtracer = require('../../node_modules/.cache/mascot-vector/node_modules/@visioncortex/vtracer')
const settings = require('./vector-settings.json')

async function main() {
  const source = path.join(__dirname, process.argv[2] || 'reference-v3.png')
  const sourceMetadata = await sharp(source).metadata()
  const { data, info } = await sharp(source)
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true })

  // Ignore almost transparent fringes; keep RGB untouched. Remove only tiny
  // disconnected alpha islands, never color details inside the character.
  const count = info.width * info.height
  const seen = new Uint8Array(count)
  const queue = new Uint32Array(count)

  // V3 has a painted checkerboard instead of an alpha channel. During tracing,
  // discard only neutral light background connected to the image boundary.
  // Closed dark outlines protect the pale hair, cream jacket and code window.
  if (!sourceMetadata.hasAlpha) {
    let head = 0
    let tail = 0
    const addBackground = (pixel) => {
      if (pixel < 0 || pixel >= count || seen[pixel]) return
      seen[pixel] = 1
      const offset = pixel * 4
      const minimum = Math.min(data[offset], data[offset + 1], data[offset + 2])
      const maximum = Math.max(data[offset], data[offset + 1], data[offset + 2])
      if (minimum < 224 || maximum - minimum > 18) return
      data[offset + 3] = 0
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
    while (head < tail) {
      const current = queue[head++]
      const x = current % info.width
      if (x) addBackground(current - 1)
      if (x < info.width - 1) addBackground(current + 1)
      addBackground(current - info.width)
      addBackground(current + info.width)
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
    '<desc id="mascot-description">原创工具站小助手小栈：薄荷白短发、金色光标发夹，穿青白色宽松夹克，托着笔记本并指向代码窗口。</desc>')
  if (/<image\b|data:image|base64|<script\b/i.test(svg)) throw new Error('Expected a self-contained path-only SVG')
  fs.writeFileSync(path.join(__dirname, '../../public/mascot.svg'), svg)
  console.log(JSON.stringify({
    bytes: Buffer.byteLength(svg),
    gzipBytes: zlib.gzipSync(svg).length,
    paths: (svg.match(/<path\b/g) || []).length,
  }))
}

main().catch(error => { console.error(error); process.exitCode = 1 })
