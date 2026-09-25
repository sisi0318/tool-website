import { describe, expect, it } from "vitest"
import { extensionForMime, fileBaseName, outputFileName } from "./output-name"

describe("output names", () => {
  it("maps MIME types to the extensions people expect", () => {
    expect(extensionForMime("image/jpeg")).toBe("jpg")
    expect(extensionForMime("image/svg+xml")).toBe("svg")
    expect(extensionForMime("text/plain;charset=utf-8")).toBe("txt")
    expect(extensionForMime("image/heic")).toBe("heic")
    expect(extensionForMime("image/x-portable-pixmap", "png")).toBe("png")
    expect(extensionForMime(undefined)).toBe("bin")
  })

  it("keeps everything but the last extension and removes unsafe characters", () => {
    expect(fileBaseName("scan.2026.09.pdf", "doc")).toBe("scan.2026.09")
    expect(fileBaseName("a/b:c?.png", "img")).toBe("a_b_c_")
    expect(fileBaseName("", "img")).toBe("img")
    expect(fileBaseName(".png", "img")).toBe("img")
  })

  it("names outputs after the source and the actual encoded type", () => {
    expect(outputFileName("photo.jpeg", "compressed", "image/webp")).toBe("photo_compressed.webp")
    expect(outputFileName("photo.jpeg", "compressed", "image/png")).toBe("photo_compressed.png")
    expect(outputFileName(undefined, "", "application/pdf", "images")).toBe("images.pdf")
  })
})
