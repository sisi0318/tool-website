const QUERY_CACHES = new Set(["cross-origin", "apis"])
const RESOURCE_CACHES = new Set(["start-url", "google-fonts-stylesheets", "google-fonts-webfonts", "next-data", "next-image", "next-static-js-assets", "pages", "pages-rsc", "pages-rsc-prefetch", "static-audio-assets", "static-data-assets", "static-font-assets", "static-image-assets", "static-js-assets", "static-style-assets", "static-video-assets", "ocr-public-models", "image-vectorizer-assets", "pdf-viewer-assets"])
export interface AppCacheUsage { name: string; entries: number; queryData: boolean }
export function isOwnedAppCache(name: string) { return QUERY_CACHES.has(name) || RESOURCE_CACHES.has(name) || name.startsWith("workbox-precache-v2-") }
export async function readAppCacheUsage(): Promise<AppCacheUsage[]> {
  if (typeof caches === "undefined") return []
  const names = (await caches.keys()).filter(isOwnedAppCache)
  return Promise.all(names.map(async name => ({ name, entries: (await (await caches.open(name)).keys()).length, queryData: QUERY_CACHES.has(name) })))
}
/** Clear only this application's caches. Query-only clearing preserves offline models. */
export async function clearAppCaches(queryOnly = false): Promise<number> {
  if (typeof caches === "undefined") return 0
  const names = (await caches.keys()).filter(name => queryOnly ? QUERY_CACHES.has(name) : isOwnedAppCache(name))
  const results = await Promise.all(names.map(name => caches.delete(name)))
  return results.filter(Boolean).length
}
