import { describe, it, expect, beforeEach } from "vitest"
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
import { registerPasswordGeneratorAdapter } from "../adapters/password-generator"
import { registerImageConvertAdapter } from "../adapters/image-convert"

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
  registerPasswordGeneratorAdapter()
  registerImageConvertAdapter()
})

describe("Adapter Config Validation", () => {
  const adapters = [
    { type: "hash", expectedConfigCount: 4, hasLinkedOptions: true },
    { type: "hmac", expectedConfigCount: 4, hasLinkedOptions: false },
    { type: "encoding", expectedConfigCount: 3, hasLinkedOptions: false },
    { type: "classic-cipher", expectedConfigCount: 3, hasLinkedOptions: true },
    { type: "json-format", expectedConfigCount: 3, hasLinkedOptions: false },
    { type: "protobuf", expectedConfigCount: 3, hasLinkedOptions: false },
    { type: "image-compress", expectedConfigCount: 3, hasLinkedOptions: false },
    { type: "image-editor", expectedConfigCount: 5, hasLinkedOptions: false },
    { type: "qrcode", expectedConfigCount: 5, hasLinkedOptions: false },
    { type: "meme-splitter", expectedConfigCount: 3, hasLinkedOptions: false },
    { type: "regex", expectedConfigCount: 4, hasLinkedOptions: false },
    { type: "http-tester", expectedConfigCount: 4, hasLinkedOptions: false },
    { type: "uuid", expectedConfigCount: 3, hasLinkedOptions: false },
    { type: "base-converter", expectedConfigCount: 2, hasLinkedOptions: false },
    { type: "temperature-converter", expectedConfigCount: 3, hasLinkedOptions: false },
    { type: "image-to-base64", expectedConfigCount: 2, hasLinkedOptions: false },
    { type: "exif-viewer", expectedConfigCount: 2, hasLinkedOptions: false },
    { type: "password-generator", expectedConfigCount: 6, hasLinkedOptions: false },
    { type: "image-convert", expectedConfigCount: 5, hasLinkedOptions: false },
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

describe("Port Design Validation", () => {
  it("hash: data is input-only, category/algorithm are internal, outputFormat has output, hash is derived output", () => {
    const def = getNodeDefinition("hash")
    const dataField = def!.config.find((f) => f.id === "data")!
    const categoryField = def!.config.find((f) => f.id === "category")!
    const algorithmField = def!.config.find((f) => f.id === "algorithm")!
    const outputFormatField = def!.config.find((f) => f.id === "outputFormat")!
    
    expect(dataField.hasInput).toBe(true)
    expect(dataField.hasOutput).toBe(false)
    
    expect(categoryField.hasInput).toBe(false)
    expect(categoryField.hasOutput).toBe(false)
    
    expect(algorithmField.hasInput).toBe(false)
    expect(algorithmField.hasOutput).toBe(false)
    
    expect(outputFormatField.hasInput).toBe(false)
    expect(outputFormatField.hasOutput).toBe(true)
    
    expect(def!.outputs).toHaveLength(1)
    expect(def!.outputs[0].id).toBe("hash")
  })

  it("encoding: input is input-only, encoding has input+output", () => {
    const def = getNodeDefinition("encoding")
    const inputField = def!.config.find((f) => f.id === "input")!
    const encodingField = def!.config.find((f) => f.id === "encoding")!
    
    expect(inputField.hasInput).toBe(true)
    expect(inputField.hasOutput).toBe(false)
    
    expect(encodingField.hasInput).toBe(true)
    expect(encodingField.hasOutput).toBe(true)
  })
})
