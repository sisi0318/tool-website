import { describe, it, expect, vi, beforeEach } from "vitest"
import { getNodeDefinition, clearRegistry } from "../canvas/registry"
import { registerHashAdapter } from "../adapters/hash"
import { registerHmacAdapter } from "../adapters/hmac"
import { registerEncodingAdapter } from "../adapters/encoding"
import { registerClassicCipherAdapter } from "../adapters/classic-cipher"
import { registerJsonFormatAdapter } from "../adapters/json-format"
import { registerProtobufAdapter } from "../adapters/protobuf"
import { registerImageCompressAdapter } from "../adapters/image-compress"
import { registerImageEditorAdapter } from "../adapters/image-editor"
import { registerQrcodeAdapter } from "../adapters/qrcode"
import { registerMemeSplitterAdapter } from "../adapters/meme-splitter"
import { registerRegexAdapter } from "../adapters/regex"
import { registerHttpTesterAdapter } from "../adapters/http-tester"
import { registerUuidAdapter } from "../adapters/uuid"
import { registerBaseConverterAdapter } from "../adapters/base-converter"
import { registerTemperatureConverterAdapter } from "../adapters/temperature-converter"
import { registerImageToBase64Adapter } from "../adapters/image-to-base64"
import { registerExifViewerAdapter } from "../adapters/exif-viewer"

beforeEach(() => {
  clearRegistry()
  registerHashAdapter()
  registerHmacAdapter()
  registerEncodingAdapter()
  registerClassicCipherAdapter()
  registerJsonFormatAdapter()
  registerProtobufAdapter()
  registerImageCompressAdapter()
  registerImageEditorAdapter()
  registerQrcodeAdapter()
  registerMemeSplitterAdapter()
  registerRegexAdapter()
  registerHttpTesterAdapter()
  registerUuidAdapter()
  registerBaseConverterAdapter()
  registerTemperatureConverterAdapter()
  registerImageToBase64Adapter()
  registerExifViewerAdapter()
})

describe("Adapter Config Validation", () => {
  const adapters = [
    { type: "hash", expectedConfigCount: 3, hasLinkedOptions: true },
    { type: "hmac", expectedConfigCount: 3, hasLinkedOptions: false },
    { type: "encoding", expectedConfigCount: 1, hasLinkedOptions: false },
    { type: "classic-cipher", expectedConfigCount: 7, hasLinkedOptions: true },
    { type: "json-format", expectedConfigCount: 2, hasLinkedOptions: false },
    { type: "protobuf", expectedConfigCount: 2, hasLinkedOptions: false },
    { type: "image-compress", expectedConfigCount: 2, hasLinkedOptions: false },
    { type: "image-editor", expectedConfigCount: 4, hasLinkedOptions: false },
    { type: "qrcode", expectedConfigCount: 4, hasLinkedOptions: false },
    { type: "meme-splitter", expectedConfigCount: 2, hasLinkedOptions: false },
    { type: "regex", expectedConfigCount: 3, hasLinkedOptions: false },
    { type: "http-tester", expectedConfigCount: 2, hasLinkedOptions: false },
    { type: "uuid", expectedConfigCount: 3, hasLinkedOptions: false },
    { type: "base-converter", expectedConfigCount: 1, hasLinkedOptions: false },
    { type: "temperature-converter", expectedConfigCount: 1, hasLinkedOptions: false },
    { type: "image-to-base64", expectedConfigCount: 1, hasLinkedOptions: false },
    { type: "exif-viewer", expectedConfigCount: 1, hasLinkedOptions: false },
  ]

  for (const { type, expectedConfigCount, hasLinkedOptions } of adapters) {
    it(`${type}: config count = ${expectedConfigCount}`, () => {
      const def = getNodeDefinition(type)
      expect(def).toBeDefined()
      expect(def!.config).toHaveLength(expectedConfigCount)
    })

    if (hasLinkedOptions) {
      it(`${type}: has linked options (dependsOn + dynamicOptions)`, () => {
        const def = getNodeDefinition(type)
        const linkedFields = def!.config.filter((f) => f.dependsOn)
        expect(linkedFields.length).toBeGreaterThan(0)
      })
    }
  }
})

describe("Control Type Coverage", () => {
  it("has dropdown selects for options fields", () => {
    const typesWithSelects = [
      "hash", "hmac", "encoding", "classic-cipher",
      "image-compress", "qrcode", "http-tester", "uuid", "base-converter",
      "temperature-converter", "image-to-base64", "exif-viewer",
    ]
    for (const type of typesWithSelects) {
      const def = getNodeDefinition(type)
      const fieldsWithOptions = def!.config.filter((f) => f.options)
      expect(fieldsWithOptions.length).toBeGreaterThan(0)
    }
  })

  it("has sliders for slider fields", () => {
    const typesWithSliders = [
      "json-format", "image-compress", "image-editor", "qrcode", "meme-splitter", "protobuf",
    ]
    for (const type of typesWithSliders) {
      const def = getNodeDefinition(type)
      const fieldsWithSlider = def!.config.filter((f) => f.slider)
      expect(fieldsWithSlider.length).toBeGreaterThan(0)
    }
  })

  it("has switches for boolean fields", () => {
    const typesWithSwitches = ["json-format", "image-editor", "uuid"]
    for (const type of typesWithSwitches) {
      const def = getNodeDefinition(type)
      const booleanFields = def!.config.filter((f) => f.dataType === "boolean")
      expect(booleanFields.length).toBeGreaterThan(0)
    }
  })

  it("has color pickers for color fields", () => {
    const def = getNodeDefinition("qrcode")
    const colorFields = def!.config.filter((f) => f.color)
    expect(colorFields.length).toBe(2)
  })

  it("has textareas for multiline fields", () => {
    const typesWithTextarea = ["regex", "http-tester"]
    for (const type of typesWithTextarea) {
      const def = getNodeDefinition(type)
      const multilineFields = def!.config.filter((f) => f.multiline)
      expect(multilineFields.length).toBeGreaterThan(0)
    }
  })
})
