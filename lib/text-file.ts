export type TextFileErrorCode = "tooLarge" | "notText"

export class TextFileError extends Error {
  constructor(readonly code: TextFileErrorCode) {
    super(code)
    this.name = "TextFileError"
  }
}

/**
 * 读取用户打开的文本文件：按 BOM 选编码（UTF-8 / UTF-16），BOM 本身去掉；
 * 没有 BOM 时严格按 UTF-8 解码。解不出来或含 NUL 字符的按“不是文本”报错，
 * 而不是悄悄换成 � 塞进输入框。
 */
export async function readTextFile(file: Blob, maxBytes: number): Promise<string> {
  if (file.size > maxBytes) throw new TextFileError("tooLarge")
  const bytes = new Uint8Array(await file.arrayBuffer())
  const encoding = bytes[0] === 0xff && bytes[1] === 0xfe ? "utf-16le" : bytes[0] === 0xfe && bytes[1] === 0xff ? "utf-16be" : "utf-8"
  let text: string
  try {
    text = new TextDecoder(encoding, { fatal: true }).decode(bytes)
  } catch {
    throw new TextFileError("notText")
  }
  if (text.includes("\u0000")) throw new TextFileError("notText")
  return text
}
