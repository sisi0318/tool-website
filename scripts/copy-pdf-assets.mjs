import { cp, mkdir, readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import path from "node:path"

const require = createRequire(import.meta.url)
const packagePath = require.resolve("pdfjs-dist/package.json")
const { version } = JSON.parse(await readFile(packagePath, "utf8"))
const source = path.dirname(packagePath)
const destination = path.resolve("public", "pdfjs", version)
await mkdir(destination, { recursive: true })
for (const folder of ["cmaps", "standard_fonts", "wasm"]) await cp(path.join(source, folder), path.join(destination, folder), { recursive: true })
await cp(path.join(source, "LICENSE"), path.join(destination, "LICENSE"))
