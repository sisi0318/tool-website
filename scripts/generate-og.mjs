// 用 sharp 把下面这张 SVG 画成社交分享卡片 public/og.png（1200×630）
// 运行: npm run og
//
// 以前的分享图是一张成品位图，上面的“30+ 个实用工具”改不了，工具涨到 60 个它还是 30+。
// 现在整张图由这里的 SVG 画出来，吉祥物取自 public/mascot.svg，要改文案或配色改这个文件再跑一遍。
// 图上不写工具数量：写了就会再过期一次。
//
// 文字用的是本机字体（Windows 的微软雅黑、macOS 的苹方），所以要在装有中文字体的机器上生成，
// 生成的 PNG 提交进仓库；构建和 CI 不会跑这个脚本。
import sharp from "sharp"
import { readFile } from "node:fs/promises"
import path from "node:path"

const WIDTH = 1200
const HEIGHT = 630

// 与 app/globals.css 浅色主题的令牌一致
const SURFACE = "#FDFDF5"
const INK = "#1A1C19"
const INK_SOFT = "#444744"
const GREEN = "#40702E"
const GREEN_CONTAINER = "#C8E6C9"
const MINT = "#E8F5E9"
const TEAL = "#007B6F"
const TEAL_CONTAINER = "#B2DFDB"
const OUTLINE = "#C4C7C3"

const SANS = "'Microsoft YaHei', 'PingFang SC', 'Noto Sans CJK SC', 'Source Han Sans SC', sans-serif"
const MONO = "'Cascadia Code', Consolas, 'SF Mono', Menlo, monospace"

/** 一格点阵，用作角落的底纹 */
function dots(x, y, columns, rows, gap, color, opacity) {
  let out = ""
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      out += `<circle cx="${x + column * gap}" cy="${y + row * gap}" r="2.6" />`
    }
  }
  return `<g fill="${color}" opacity="${opacity}">${out}</g>`
}

/** 左侧的卖点标签：对勾 + 文字 */
function chip(x, y, label) {
  const height = 50
  const width = 64 + label.length * 24
  return `
    <g transform="translate(${x} ${y})">
      <rect width="${width}" height="${height}" rx="${height / 2}" fill="#FFFFFF" fill-opacity="0.92" stroke="${OUTLINE}" stroke-width="1.5" />
      <circle cx="27" cy="${height / 2}" r="11" fill="${GREEN_CONTAINER}" />
      <path d="M21.5 ${height / 2 + 0.5} l4 4 l7 -8" fill="none" stroke="${GREEN}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" />
      <text x="46" y="${height / 2 + 8.5}" font-family="${SANS}" font-size="24" fill="${INK_SOFT}">${label}</text>
    </g>`
}

/** 浮在吉祥物周围的小卡片：一个图标加两条示意的文字线 */
function floatingCard({ x, y, width, height, rotate, body }) {
  return `
    <g transform="translate(${x} ${y}) rotate(${rotate} ${width / 2} ${height / 2})" filter="url(#lift)">
      <rect width="${width}" height="${height}" rx="20" fill="#FFFFFF" stroke="${OUTLINE}" stroke-width="1.2" />
      ${body}
    </g>`
}

/** public/mascot.svg 作为内嵌的 <svg> 放进画面，保留它自己的 viewBox */
async function mascot(root, x, y, size) {
  const source = await readFile(path.join(root, "public", "mascot.svg"), "utf8")
  const viewBox = source.match(/<svg[^>]*viewBox="([^"]+)"/)?.[1]
  const start = source.indexOf(">", source.indexOf("<svg")) + 1
  const end = source.lastIndexOf("</svg>")
  if (!viewBox || end < start) throw new Error("public/mascot.svg 的结构变了，取不到 viewBox 或内容")
  return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="${viewBox}">${source.slice(start, end)}</svg>`
}

async function card(root) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <linearGradient id="halo" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${GREEN_CONTAINER}" />
      <stop offset="1" stop-color="${TEAL_CONTAINER}" />
    </linearGradient>
    <linearGradient id="brand" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#4A8135" />
      <stop offset="1" stop-color="#3A6829" />
    </linearGradient>
    <filter id="lift" x="-30%" y="-30%" width="160%" height="180%">
      <feDropShadow dx="0" dy="8" stdDeviation="9" flood-color="${INK}" flood-opacity="0.13" />
    </filter>
    <clipPath id="frame"><rect width="${WIDTH}" height="${HEIGHT}" /></clipPath>
  </defs>

  <g clip-path="url(#frame)">
    <rect width="${WIDTH}" height="${HEIGHT}" fill="${SURFACE}" />

    <!-- 角落的色块与点阵 -->
    <path d="M0 0 H400 C372 78 286 118 196 128 C104 138 48 196 0 246 Z" fill="${GREEN_CONTAINER}" opacity="0.55" />
    <path d="M0 630 V532 C96 508 196 566 330 630 Z" fill="${TEAL_CONTAINER}" opacity="0.5" />
    <path d="M1200 0 V150 C1150 120 1128 60 1060 0 Z" fill="${MINT}" />
    ${dots(86, 566, 7, 3, 20, GREEN, 0.22)}
    ${dots(1066, 34, 6, 3, 20, TEAL, 0.2)}

    <!-- 吉祥物身后的光晕 -->
    <circle cx="900" cy="372" r="252" fill="url(#halo)" opacity="0.9" />
    <circle cx="900" cy="372" r="282" fill="none" stroke="${GREEN}" stroke-opacity="0.16" stroke-width="2" stroke-dasharray="3 12" stroke-linecap="round" />

    ${await mascot(root, 620, 96, 568)}

    <!-- 浮动的小卡片：JSON、哈希、图片 -->
    ${floatingCard({
      x: 600, y: 118, width: 150, height: 92, rotate: -7,
      body: `
        <text x="18" y="58" font-family="${MONO}" font-size="36" font-weight="700" fill="${GREEN}">{ }</text>
        <rect x="100" y="34" width="32" height="8" rx="4" fill="${GREEN_CONTAINER}" />
        <rect x="100" y="52" width="22" height="8" rx="4" fill="${OUTLINE}" opacity="0.7" />`,
    })}
    ${floatingCard({
      x: 1058, y: 150, width: 118, height: 84, rotate: 7,
      body: `
        <rect x="18" y="18" width="48" height="48" rx="14" fill="${GREEN}" />
        <text x="42" y="54" text-anchor="middle" font-family="${MONO}" font-size="34" font-weight="700" fill="#FFFFFF">#</text>
        <rect x="76" y="30" width="26" height="8" rx="4" fill="${GREEN_CONTAINER}" />
        <rect x="76" y="46" width="18" height="8" rx="4" fill="${OUTLINE}" opacity="0.7" />`,
    })}
    ${floatingCard({
      x: 1070, y: 356, width: 108, height: 90, rotate: -5,
      body: `
        <rect x="16" y="16" width="76" height="58" rx="12" fill="${TEAL_CONTAINER}" />
        <circle cx="36" cy="34" r="7" fill="${TEAL}" />
        <path d="M22 68 L44 44 L58 58 L68 50 L86 68 Z" fill="${TEAL}" />`,
    })}
    <path d="M664 268 l5 13 l13 5 l-13 5 l-5 13 l-5 -13 l-13 -5 l13 -5 Z" fill="${TEAL}" opacity="0.55" />
    <path d="M1150 290 l3.5 9 l9 3.5 l-9 3.5 l-3.5 9 l-3.5 -9 l-9 -3.5 l9 -3.5 Z" fill="${GREEN}" opacity="0.5" />

    <!-- 左侧：品牌标签、标题、口号、卖点 -->
    <g transform="translate(80 112)">
      <rect width="214" height="48" rx="24" fill="#FFFFFF" fill-opacity="0.92" stroke="${OUTLINE}" stroke-width="1.5" />
      <rect x="8" y="8" width="32" height="32" rx="9" fill="url(#brand)" />
      <rect x="15" y="15" width="7.5" height="7.5" rx="2" fill="${SURFACE}" />
      <rect x="25.5" y="15" width="7.5" height="7.5" rx="2" fill="${SURFACE}" />
      <rect x="15" y="25.5" width="7.5" height="7.5" rx="2" fill="${SURFACE}" />
      <rect x="25.5" y="25.5" width="7.5" height="7.5" rx="2" fill="${SURFACE}" opacity="0.72" />
      <text x="52" y="32" font-family="${SANS}" font-size="22" fill="${INK_SOFT}">在线工具集合</text>
    </g>

    <text x="74" y="326" font-family="${SANS}" font-size="138" font-weight="700" letter-spacing="6" fill="${INK}">工具站</text>
    <path d="M84 360 C196 344 338 340 506 350" fill="none" stroke="${GREEN}" stroke-width="9" stroke-linecap="round" />
    <text x="80" y="428" font-family="${SANS}" font-size="44" letter-spacing="2" fill="${GREEN}">顺手完成每一件小事</text>

    ${chip(80, 470, "无需安装")}
    ${chip(254, 470, "打开即用")}
    ${chip(428, 470, "本地处理")}
  </g>
</svg>`
}

const root = path.resolve(import.meta.dirname, "..")
const output = path.join(root, "public", "og.png")
const svg = await card(root)
// 色块、渐变和手绘风的吉祥物用调色板 PNG 足够，文字边缘比 JPEG 干净，体积也小
await sharp(Buffer.from(svg)).resize(WIDTH, HEIGHT).png({ palette: true, quality: 92, effort: 10, compressionLevel: 9 }).toFile(output)
console.log("written", output)
