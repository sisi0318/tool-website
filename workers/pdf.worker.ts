import { composePdfs, createPdfSample, imagesToPdf, inspectPdfs } from "../lib/pdf-tools"
import { PdfToolError, type PdfComposition } from "../lib/pdf-shared"
import type { PdfTaskRequest, PdfTaskResponse } from "../lib/pdf-worker-client"

const scope = self as unknown as { onmessage: ((event: MessageEvent<PdfTaskRequest>) => void) | null; postMessage: (response: PdfTaskResponse, transfer?: Transferable[]) => void }
scope.onmessage = async ({ data }) => {
  try {
    const progress = (value: Parameters<NonNullable<Parameters<typeof composePdfs>[2]>>[0]) => scope.postMessage({ type: "progress", progress: value })
    if (data.type === "sample") {
      const bytes = await createPdfSample(), name = "sample.pdf", [info] = await inspectPdfs([{ name, bytes }])
      scope.postMessage({ type: "done", value: { name, bytes, info } }, [bytes.buffer as ArrayBuffer])
    } else if (data.type === "inspect") scope.postMessage({ type: "done", value: await inspectPdfs(data.sources, progress) })
    else {
      const result: PdfComposition = data.type === "images" ? await imagesToPdf(data.sources, data.options, progress) : await composePdfs(data.sources, data.options, progress)
      scope.postMessage({ type: "done", value: result }, result.files.map((file) => file.bytes.buffer as ArrayBuffer))
    }
  } catch (cause) {
    const error = cause instanceof PdfToolError ? cause : new PdfToolError("invalidPdf", cause instanceof Error ? cause.message : "")
    scope.postMessage({ type: "error", error: { code: error.code, detail: error.detail.slice(0, 2048) } })
  }
}
