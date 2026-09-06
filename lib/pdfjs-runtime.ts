let modulePromise: Promise<typeof import("pdfjs-dist")> | undefined
export function loadPdfJs() {
  return modulePromise ??= import("pdfjs-dist").then(pdfjs => {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).href
    return pdfjs
  }).catch(cause => { modulePromise = undefined; throw cause })
}
export function pdfJsOptions(pdfjs: typeof import("pdfjs-dist")) {
  const assets = new URL(`/pdfjs/${pdfjs.version}/`, window.location.origin).href
  return { cMapUrl: assets + "cmaps/", cMapPacked: true, standardFontDataUrl: assets + "standard_fonts/", wasmUrl: assets + "wasm/", enableXfa: false, maxImageSize: 20_000_000, canvasMaxAreaInBytes: 32 * 1024 * 1024, useSystemFonts: true }
}
