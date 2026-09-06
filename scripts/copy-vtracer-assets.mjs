import { cp, mkdir, readFile, writeFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { createHash } from "node:crypto"
import path from "node:path"

const require = createRequire(import.meta.url)
const packageFile = require.resolve("@visioncortex/vtracer/package.json")
const { version } = JSON.parse(await readFile(packageFile, "utf8"))
if (version !== "1.0.0-alpha.4") throw new Error("Review the browser adapter before upgrading VTracer")
const source = path.join(path.dirname(packageFile), "pkg")
let glue = (await readFile(path.join(source, "vtracer_wasm.js"), "utf8")).replace(/\r\n/g, "\n")
if (createHash("sha256").update(glue).digest("hex") !== "e1855e9bb29d785344f672abdc692ca90ffa7ed863b9186b51c4e95a2a7dc17d") throw new Error("VTracer generated bindings changed")
glue = glue.replace(/^exports\.vectorize_\w+ = vectorize_\w+;\n/gm, "")
glue = glue.slice(0, glue.indexOf("const wasmPath = "))
glue = `// Browser adapter of VTracer ${version}; see ./LICENSE.\n` + glue + `
let wasm;
let initialization;
export function initialize() {
  initialization ??= (async () => {
    const response = await fetch(new URL('./vtracer_wasm_bg.wasm', import.meta.url));
    if (!response.ok) throw new Error('Unable to load the local vectorizer runtime');
    const { instance } = await WebAssembly.instantiate(await response.arrayBuffer(), __wbg_get_imports());
    wasm = instance.exports;
    wasm.__wbindgen_start();
  })();
  return initialization;
}
export { vectorize_rgba };
`
if (/require\(|exports\.|__dirname/.test(glue)) throw new Error("Node code remains in browser bindings")
const destination = path.resolve("public", "vtracer", version)
await mkdir(destination, { recursive: true })
await writeFile(path.join(destination, "vtracer-browser.mjs"), glue)
await cp(path.join(source, "vtracer_wasm_bg.wasm"), path.join(destination, "vtracer_wasm_bg.wasm"))
await cp(path.resolve("vendor/vtracer/LICENSE"), path.join(destination, "LICENSE"))
