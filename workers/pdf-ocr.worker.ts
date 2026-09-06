import { searchablePdf } from "../lib/pdf-searchable"
import { PdfToolError } from "../lib/pdf-shared"
import type { PdfOcrPage } from "../lib/pdf-ocr-shared"
const scope = self as unknown as { onmessage: ((event: MessageEvent<PdfOcrPage[]>) => void) | null; postMessage(value: unknown, transfer?: Transferable[]): void }
scope.onmessage = async ({ data }) => {
  try { const bytes = await searchablePdf(data); scope.postMessage({ bytes }, [bytes.buffer]) }
  catch (error) { scope.postMessage({ error: error instanceof PdfToolError ? error.code : "workerFailed" }) }
}
