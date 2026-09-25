import { describe, expect, it } from "vitest"
import { readTextFile, TextFileError } from "./text-file"

// jsdom 的 Blob 没有 arrayBuffer()，和其它测试一样给对象补上
function blob(...parts: Array<number[] | string>): Blob {
  const chunks = parts.map((part) => typeof part === "string" ? new TextEncoder().encode(part) : new Uint8Array(part))
  const bytes = new Uint8Array(chunks.reduce((size, chunk) => size + chunk.length, 0))
  chunks.reduce((offset, chunk) => { bytes.set(chunk, offset); return offset + chunk.length }, 0)
  const value = new Blob([bytes])
  Object.defineProperty(value, "arrayBuffer", { value: async () => bytes.buffer })
  return value
}

async function failure(promise: Promise<unknown>) {
  try {
    await promise
  } catch (error) {
    return error instanceof TextFileError ? error.code : error
  }
  return "resolved"
}

describe("readTextFile", () => {
  it("drops a UTF-8 BOM", async () => {
    expect(await readTextFile(blob([0xef, 0xbb, 0xbf], "a,b\n中文"), 1024)).toBe("a,b\n中文")
  })

  it("decodes UTF-16 files marked by their BOM", async () => {
    expect(await readTextFile(blob([0xff, 0xfe, 0x68, 0x00, 0x69, 0x00]), 1024)).toBe("hi")
    expect(await readTextFile(blob([0xfe, 0xff, 0x00, 0x68, 0x00, 0x69]), 1024)).toBe("hi")
  })

  it("refuses binary data and invalid UTF-8 instead of inserting replacement characters", async () => {
    expect(await failure(readTextFile(blob([0x89, 0x50, 0x4e, 0x47, 0xff, 0x00]), 1024))).toBe("notText")
    expect(await failure(readTextFile(blob("abc", [0x00], "def"), 1024))).toBe("notText")
  })

  it("enforces the size limit before reading", async () => {
    expect(await failure(readTextFile(blob("x".repeat(20)), 10))).toBe("tooLarge")
  })
})
