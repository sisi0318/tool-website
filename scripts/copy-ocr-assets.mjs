import { cp, mkdir, readFile, writeFile, rename } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { createHash } from "node:crypto"
import path from "node:path"
import { build } from "esbuild"

async function packageRoot(name) {
  let directory = path.dirname(fileURLToPath(import.meta.resolve(name)))
  while (path.dirname(directory) !== directory) {
    try { if (JSON.parse(await readFile(path.join(directory, "package.json"), "utf8")).name === name) return directory } catch { /* package entry may be nested */ }
    directory = path.dirname(directory)
  }
  throw new Error(`Cannot locate OCR dependency ${name}`)
}
const paddleRoot = await packageRoot("@paddleocr/paddleocr-js"), ortRoot = await packageRoot("onnxruntime-web")
const paddlePackage = JSON.parse(await readFile(path.join(paddleRoot, "package.json"), "utf8"))
const ortPackage = JSON.parse(await readFile(path.join(ortRoot, "package.json"), "utf8"))
if (paddlePackage.version !== "0.4.2" || ortPackage.version !== "1.29.0") throw new Error("Review OCR worker adaptation before upgrading its runtime")
const entry = path.join(paddleRoot, "dist/index.mjs"), source = await readFile(entry, "utf8")
const sha256 = value => createHash("sha256").update(value).digest("hex")
if (sha256(source) !== "8610d82fdc539e48fa0147763be4b676c699d646a8db75fbceb627d9d37deb94") throw new Error("PaddleOCR core changed; review the export adapter")
const manifest = JSON.parse(await readFile("vendor/ocr/models.json", "utf8"))
const destination = path.resolve("public/ocr/v1"), cache = path.resolve("node_modules/.cache/ocr-models")
await mkdir(path.join(destination, "ort"), { recursive: true })
await mkdir(path.join(destination, "models"), { recursive: true })
await mkdir(cache, { recursive: true })
await build({
  entryPoints: [entry], outfile: path.join(destination, "paddle.mjs"), bundle: true, format: "esm", platform: "browser", target: "es2022", minify: true,
  external: ["fs", "path", "crypto", "url", "node:*"],
  plugins: [{ name: "worker-core-export", setup(builder) {
    builder.onResolve({ filter: /^onnxruntime-web$/ }, () => ({ path: "./ort/ort.bundle.min.mjs", external: true }))
    // The published browser facade hardcodes document.createElement. Export its existing
    // platform-independent core so our Worker can supply cv.matFromImageData instead.
    builder.onLoad({ filter: /paddleocr-js[\\/]dist[\\/]index\.mjs$/ }, () => ({ contents: source + "\nexport { OcrPipelineRunner as PaddleOCRCore };", loader: "js" }))
  } }],
})
for (const name of ["ort.bundle.min.mjs", "ort-wasm-simd-threaded.jsep.mjs", "ort-wasm-simd-threaded.jsep.wasm"]) await cp(path.join(ortRoot, "dist", name), path.join(destination, "ort", name))
for (const model of manifest.models) {
  const filename = `${model.name}.tar`, cached = path.join(cache, filename)
  let bytes
  try { bytes = await readFile(cached) } catch { /* first build */ }
  if (!bytes || bytes.length !== model.bytes || sha256(bytes) !== model.sha256) {
    console.log(`Downloading verified OCR model: ${model.name}`)
    const response = await fetch(model.url, { signal: AbortSignal.timeout(180000) })
    if (!response.ok) throw new Error(`OCR model download failed: ${response.status}`)
    bytes = Buffer.from(await response.arrayBuffer())
    if (bytes.length !== model.bytes || sha256(bytes) !== model.sha256) throw new Error(`OCR model integrity check failed: ${model.name}`)
    const temporary = `${cached}.${process.pid}.tmp`
    await writeFile(temporary, bytes)
    await rename(temporary, cached)
  }
  await writeFile(path.join(destination, "models", filename), bytes)
}
await cp("vendor/ocr", path.join(destination, "licenses"), { recursive: true })
await cp(path.join(await packageRoot("@techstark/opencv-js"), "LICENSE"), path.join(destination, "licenses", "OpenCV-LICENSE"))
await cp(path.join(await packageRoot("js-yaml"), "LICENSE"), path.join(destination, "licenses", "js-yaml-LICENSE"))
console.log("OCR assets ready: PaddleOCR 0.4.2 / PP-OCRv6 small / ONNX Runtime 1.29.0")
