const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "image/bmp": "bmp",
  "image/svg+xml": "svg",
  "image/x-icon": "ico",
  "image/vnd.microsoft.icon": "ico",
  "image/tiff": "tiff",
  "application/pdf": "pdf",
  "application/zip": "zip",
  "application/json": "json",
  "application/xml": "xml",
  "text/xml": "xml",
  "text/plain": "txt",
  "text/csv": "csv",
  "text/html": "html",
}

/**
 * MIME 转扩展名。未知类型取子类型（仅限短的字母数字），再不行用 fallback ——
 * 以前有地方把整串 MIME（如 image/x-portable-pixmap）直接拼进了文件名。
 */
export function extensionForMime(mime: string | undefined, fallback = "bin"): string {
  const type = (mime ?? "").split(";")[0].trim().toLowerCase()
  if (EXTENSION_BY_MIME[type]) return EXTENSION_BY_MIME[type]
  const subtype = type.split("/")[1] ?? ""
  return /^[a-z0-9]{1,8}$/.test(subtype) ? subtype : fallback
}

/** 去掉扩展名，替换文件名里不能用的字符；多个点的名字只去最后一段 */
export function fileBaseName(name: string | undefined, fallback: string): string {
  const base = (name ?? "")
    .replace(/\.[^./\\]*$/, "")
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_")
    .trim()
    .slice(0, 100)
  return base || fallback
}

/**
 * 基于原文件名给输出命名：photo.jpg + "compressed" + image/webp → photo_compressed.webp。
 * 扩展名取实际编码结果的 MIME（blob.type），而不是请求的格式：
 * 浏览器不支持某种编码时会悄悄退回 PNG，按请求命名就会得到内容是 PNG 的 .webp 文件。
 */
export function outputFileName(sourceName: string | undefined, suffix: string, mime: string | undefined, fallbackBase = "output"): string {
  const base = fileBaseName(sourceName, fallbackBase)
  return `${suffix ? `${base}_${suffix}` : base}.${extensionForMime(mime)}`
}
