import { createHash } from "node:crypto"
import { NextResponse } from "next/server"
import { SERVER_HASH_MAX_BYTES } from "@/lib/file-limits"

export const dynamic = "force-dynamic"

/**
 * 仅开放浏览器端缺少实现的几种算法。开放式转发 createHash 参数会让这个
 * 端点变成任意摘要预言机,也方便通过报错探测运行时能力。
 */
const ALLOWED_ALGORITHMS = new Set(["sha512", "blake2s256", "blake2b512", "sm3"])
/** SHA-512/t 的截断长度,与前端提供的选项一致。 */
const ALLOWED_SHA512_SIZES = new Set([224, 256])

function createNativeHash(algorithm: string, size?: number) {
  if (algorithm === "sha512") {
    return size === undefined ? createHash("sha512") : createHash(`sha512-${size}`)
  }

  return createHash(algorithm)
}

export async function POST(request: Request) {
  // 整个请求体会读进内存,先按 content-length 挡住超限上传。
  const declaredLength = Number(request.headers.get("content-length") ?? "0")
  if (Number.isFinite(declaredLength) && declaredLength > SERVER_HASH_MAX_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 })
  }

  try {
    const formData = await request.formData()
    const algorithm = String(formData.get("algorithm") || "")
    const outputFormat = formData.get("outputFormat") === "base64" ? "base64" : "hex"
    const sizeValue = formData.get("size")
    const size = sizeValue ? Number(sizeValue) : undefined
    const text = formData.get("text")
    const file = formData.get("file")

    if (!ALLOWED_ALGORITHMS.has(algorithm)) {
      return NextResponse.json({ error: "Unsupported algorithm" }, { status: 400 })
    }

    if (size !== undefined && (algorithm !== "sha512" || !ALLOWED_SHA512_SIZES.has(size))) {
      return NextResponse.json({ error: "Unsupported digest size" }, { status: 400 })
    }

    let input: Buffer

    if (typeof text === "string") {
      input = Buffer.from(text, "utf8")
    } else if (file instanceof File) {
      if (file.size > SERVER_HASH_MAX_BYTES) {
        return NextResponse.json({ error: "Payload too large" }, { status: 413 })
      }
      input = Buffer.from(await file.arrayBuffer())
    } else {
      return NextResponse.json({ error: "Missing hash input" }, { status: 400 })
    }

    if (input.byteLength > SERVER_HASH_MAX_BYTES) {
      return NextResponse.json({ error: "Payload too large" }, { status: 413 })
    }

    const hash = createNativeHash(algorithm, size)
    hash.update(input)

    return NextResponse.json({
      result: hash.digest(outputFormat),
    })
  } catch (error) {
    console.error("Hash API error:", error)
    return NextResponse.json({ error: "Failed to calculate hash" }, { status: 500 })
  }
}
