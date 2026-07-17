export const MEBIBYTE = 1024 * 1024

export const FILE_SIZE_LIMITS = {
  binaryTool: 10 * MEBIBYTE,
  certificate: 5 * MEBIBYTE,
  officeDocument: 50 * MEBIBYTE,
  coordinateImage: 25 * MEBIBYTE,
  qrDecodeImage: 10 * MEBIBYTE,
  httpRequestBody: 25 * MEBIBYTE,
  imageBase64: 50 * MEBIBYTE,
  memeImage: 25 * MEBIBYTE,
  imageEditor: 25 * MEBIBYTE,
} as const

export function isFileWithinLimit(file: Pick<File, "size">, maxBytes: number): boolean {
  return file.size <= maxBytes
}

export function formatFileSizeLimit(maxBytes: number): string {
  const mebibytes = maxBytes / MEBIBYTE
  return Number.isInteger(mebibytes)
    ? `${mebibytes} MB`
    : `${mebibytes.toFixed(1)} MB`
}
