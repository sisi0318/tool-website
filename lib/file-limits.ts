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

/**
 * 走 /api/hash 的算法（BLAKE2 / SM3 / SHA-512/t）需要把数据上传到服务端，
 * 请求体会整块读进内存，且多数平台的函数请求体上限在 4.5MB 左右。
 */
export const SERVER_HASH_MAX_BYTES = 4 * MEBIBYTE

export function isFileWithinLimit(file: Pick<File, "size">, maxBytes: number): boolean {
  return file.size <= maxBytes
}

export function formatFileSizeLimit(maxBytes: number): string {
  const mebibytes = maxBytes / MEBIBYTE
  return Number.isInteger(mebibytes)
    ? `${mebibytes} MB`
    : `${mebibytes.toFixed(1)} MB`
}
