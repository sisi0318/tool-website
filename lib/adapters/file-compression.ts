import { Archive, ListTree } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"
import { asFile } from "../canvas/persist"
import { BinaryFileError, MAX_BINARY_FILE_BYTES, transformFileBytes, type FileCompressionFormat } from "../compression-files"
import { createBinaryFile, detectFileSignature } from "../file-signature"
import { createZip, extractZipEntry, inspectZip, normalizeZipPath, type ZipNameEncoding } from "../zip-tools"

function detectCompression(bytes: Uint8Array, filename: string): FileCompressionFormat | "zip" {
  const signature = detectFileSignature(bytes)
  if (signature.id === "zip" || signature.id === "emptyZip") return "zip"
  if (signature.id === "gzip") return "gzip"
  if (bytes.length >= 2 && (bytes[0] & 15) === 8 && bytes[0] >>> 4 <= 7 && ((bytes[0] << 8) | bytes[1]) % 31 === 0) return "zlib"
  if (/\.br$/i.test(filename)) return "brotli"
  if (/\.deflate$/i.test(filename)) return "deflate"
  throw new BinaryFileError("formatRequired", "", "Select a compression format for this file.")
}

export const fileCompressionAdapter: ToolAdapter = {
  type: "compression-file", category: "data", label: "File Compression", icon: Archive,
  description: "Compress or decompress binary files with GZip, Zlib, Deflate, Brotli or ZIP",
  config: [
    { id: "file", name: "File", dataType: "bytes", hasInput: true },
    { id: "operation", name: "Operation", dataType: "string", defaultValue: "decompress", options: [{ label: "Decompress", value: "decompress" }, { label: "Compress", value: "compress" }] },
    { id: "format", name: "Format", dataType: "string", defaultValue: "auto", options: [{ label: "Auto (GZip when compressing)", value: "auto" }, { label: "GZip", value: "gzip" }, { label: "Zlib", value: "zlib" }, { label: "Deflate", value: "deflate" }, { label: "Brotli", value: "brotli" }, { label: "ZIP", value: "zip" }] },
    { id: "entryPath", name: "ZIP entry path (empty for a single-file ZIP)", dataType: "string", defaultValue: "", visible: (config) => config.operation !== "compress" && (config.format === "auto" || config.format === "zip") },
    { id: "entryIndex", name: "ZIP entry index (-1 = use path)", dataType: "number", defaultValue: -1, visible: (config) => config.operation !== "compress" && (config.format === "auto" || config.format === "zip") },
    { id: "level", name: "Compression level", dataType: "number", defaultValue: 6, slider: { min: 0, max: 11, step: 1 }, visible: (config) => config.operation === "compress" },
  ],
  outputs: [{ id: "file", name: "Output file", dataType: "bytes" }, { id: "inputBytes", name: "Input bytes", dataType: "number" }, { id: "outputBytes", name: "Output bytes", dataType: "number" }, { id: "ratio", name: "Size ratio", dataType: "number" }],
  async execute(inputs, config, context) {
    const file = asFile(inputs.file ?? config.file)
    if (!file) throw new BinaryFileError("invalidInput")
    if (file.size > MAX_BINARY_FILE_BYTES) throw new BinaryFileError("inputLimit")
    const source = new Uint8Array(await file.arrayBuffer())
    const operation = String(config.operation ?? "decompress")
    if (operation !== "compress" && operation !== "decompress") throw new BinaryFileError("invalidInput")
    const requested = String(config.format ?? "auto")
    const format = requested === "auto" ? operation === "compress" ? "gzip" : detectCompression(source, file.name) : requested
    let data: Uint8Array<ArrayBuffer>
    let filename: string
    if (format === "zip") {
      if (operation === "compress") {
        data = await createZip([{ name: file.name, data: source, modifiedAt: file.lastModified }], { level: Number(config.level ?? 6), signal: context?.signal })
        filename = file.name + ".zip"
      } else {
        const archive = inspectZip(source)
        const path = String(config.entryPath ?? "").trim()
        const index = Number(config.entryIndex ?? -1)
        if (!Number.isInteger(index) || index < -1) throw new BinaryFileError("invalidInput")
        const matches = archive.entries.filter((entry) => !entry.directory && (index >= 0 ? entry.id === index : path ? entry.path === normalizeZipPath(path) : true))
        if (!matches.length) throw new BinaryFileError("notFound", path)
        if (matches.length !== 1) throw new BinaryFileError("entryRequired", "", "Specify an entry path or index. Available: " + matches.slice(0, 10).map((entry) => "[" + entry.id + "] " + entry.path).join(", "))
        data = await extractZipEntry(archive, matches[0].id, context?.signal)
        filename = matches[0].path
      }
    } else {
      data = await transformFileBytes(source, { operation, format: format as FileCompressionFormat, level: Number(config.level ?? 6), signal: context?.signal })
      const suffix = ({ gzip: ".gz", zlib: ".zlib", deflate: ".deflate", brotli: ".br" } as Record<string, string>)[format]
      filename = operation === "compress" ? file.name + suffix : file.name.toLowerCase().endsWith(suffix) ? file.name.slice(0, -suffix.length) || "output.bin" : file.name + ".out"
    }
    return { file: createBinaryFile(data, filename), inputBytes: source.length, outputBytes: data.length, ratio: source.length ? data.length / source.length : 0 }
  },
}

export const zipDirectoryAdapter: ToolAdapter = {
  type: "zip-directory", category: "data", label: "ZIP Directory", icon: ListTree,
  description: "Read ZIP file names, sizes and metadata without extracting file contents",
  config: [{ id: "file", name: "ZIP file", dataType: "bytes", hasInput: true }, { id: "nameEncoding", name: "Filename encoding", dataType: "string", defaultValue: "auto", options: [{ label: "Auto", value: "auto" }, { label: "UTF-8", value: "utf-8" }, { label: "CP437", value: "cp437" }, { label: "GB18030 / GBK", value: "gb18030" }] }],
  outputs: [{ id: "entries", name: "Entries", dataType: "json" }, { id: "fileCount", name: "Files", dataType: "number" }, { id: "originalBytes", name: "Uncompressed bytes", dataType: "number" }, { id: "archiveBytes", name: "Archive bytes", dataType: "number" }],
  async execute(inputs, config) {
    const file = asFile(inputs.file ?? config.file)
    if (!file) throw new BinaryFileError("invalidInput")
    if (file.size > MAX_BINARY_FILE_BYTES) throw new BinaryFileError("inputLimit")
    const archive = inspectZip(new Uint8Array(await file.arrayBuffer()), String(config.nameEncoding ?? "auto") as ZipNameEncoding)
    return { entries: archive.entries.map(({ dataOffset: _offset, ...entry }) => entry), fileCount: archive.entries.filter((entry) => !entry.directory).length, originalBytes: archive.totalBytes, archiveBytes: archive.bytes.length }
  },
}

export function registerFileCompressionAdapters(): void { registerNode(fileCompressionAdapter); registerNode(zipDirectoryAdapter) }
