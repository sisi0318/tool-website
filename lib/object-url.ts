const DOWNLOAD_REVOKE_DELAY_MS = 1000

export type ObjectUrlSource = Blob | MediaSource

export function createObjectUrl(source: ObjectUrlSource): string {
  return URL.createObjectURL(source)
}

export function revokeObjectUrl(url: string | null | undefined): void {
  if (!url) return
  URL.revokeObjectURL(url)
}

export function revokeObjectUrls(urls: Iterable<string | null | undefined>): void {
  for (const url of urls) {
    revokeObjectUrl(url)
  }
}

export async function withObjectUrl<T>(
  source: ObjectUrlSource,
  operation: (url: string) => T | Promise<T>,
): Promise<T> {
  const url = createObjectUrl(source)

  try {
    return await operation(url)
  } finally {
    revokeObjectUrl(url)
  }
}

export function triggerDownload(url: string, filename: string): void {
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.style.display = "none"
  document.body.appendChild(anchor)

  try {
    anchor.click()
  } finally {
    anchor.remove()
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = createObjectUrl(blob)

  try {
    triggerDownload(url, filename)
  } finally {
    globalThis.setTimeout(() => revokeObjectUrl(url), DOWNLOAD_REVOKE_DELAY_MS)
  }
}
