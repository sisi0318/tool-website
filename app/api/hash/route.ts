import { createHash } from "node:crypto"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

function createNativeHash(algorithm: string, size?: number) {
  if (algorithm === "sha512") {
    return createHash(`sha512-${size}`)
  }

  return createHash(algorithm)
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const algorithm = String(formData.get("algorithm") || "")
    const outputFormat = String(formData.get("outputFormat") || "hex") as "hex" | "base64"
    const sizeValue = formData.get("size")
    const size = sizeValue ? Number(sizeValue) : undefined
    const text = formData.get("text")
    const file = formData.get("file")

    if (!algorithm) {
      return NextResponse.json({ error: "Missing algorithm" }, { status: 400 })
    }

    let input: Buffer

    if (typeof text === "string") {
      input = Buffer.from(text, "utf8")
    } else if (file instanceof File) {
      input = Buffer.from(await file.arrayBuffer())
    } else {
      return NextResponse.json({ error: "Missing hash input" }, { status: 400 })
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
