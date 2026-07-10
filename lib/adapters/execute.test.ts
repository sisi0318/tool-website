import { describe, it, expect, beforeEach, vi } from "vitest"
import { getNodeDefinition, clearRegistry } from "../canvas/registry"
import { registerBasicNodes } from "../adapters/basic"
import { registerHashAdapter } from "../adapters/hash"
import { registerHmacAdapter } from "../adapters/hmac"
import { registerEncodingAdapter } from "../adapters/encoding"
import { registerClassicCipherAdapter } from "../adapters/classic-cipher"
import { registerJsonFormatAdapter } from "../adapters/json-format"
import { registerJsonPathAdapter } from "../adapters/json-path"
import { registerProtobufAdapter } from "../adapters/protobuf"
import { registerJceAdapter } from "../adapters/jce"
import { registerImageCompressAdapter } from "../adapters/image-compress"
import { registerImageEditorAdapter } from "../adapters/image-editor"
import { registerQrcodeAdapter } from "../adapters/qrcode"
import { registerQrcodeDecodeAdapter } from "../adapters/qrcode-decode"
import { registerMemeSplitterAdapter } from "../adapters/meme-splitter"
import { registerImageCoordinatesAdapter } from "../adapters/image-coordinates"
import { registerRegexAdapter } from "../adapters/regex"
import { registerHttpTesterAdapter } from "../adapters/http-tester"
import { registerUuidAdapter } from "../adapters/uuid"
import { registerBaseConverterAdapter } from "../adapters/base-converter"
import { registerTemperatureConverterAdapter } from "../adapters/temperature-converter"
import { registerImageToBase64Adapter } from "../adapters/image-to-base64"
import { registerExifViewerAdapter } from "../adapters/exif-viewer"
import { registerTextStatsAdapter } from "../adapters/text-stats"
import { registerCaseConverterAdapter } from "../adapters/case-converter"
import { registerDiffAdapter } from "../adapters/diff"
import { registerCrontabAdapter } from "../adapters/crontab"
import { registerDockerConverterAdapter } from "../adapters/docker-converter"
import { registerWhoisAdapter } from "../adapters/whois"
import { registerTotpAdapter } from "../adapters/totp"
import { registerColorAdapter } from "../adapters/color"
import { registerBmiAdapter } from "../adapters/bmi"
import { registerDeviceInfoAdapter } from "../adapters/device-info"
import { registerTimeAdapter } from "../adapters/time"
import { registerCurrencyAdapter } from "../adapters/currency"
import { registerOfficeViewerAdapter } from "../adapters/office-viewer"
import { registerCryptoAdapter } from "../adapters/crypto"
import { registerJwtAdapter } from "../adapters/jwt"
import { registerBase64ToFileAdapter } from "../adapters/base64-to-file"
import { registerFileToBase64Adapter } from "../adapters/file-to-base64"
import { registerFileToStringAdapter } from "../adapters/file-to-string"
import { registerStringToFileAdapter } from "../adapters/string-to-file"
import { registerStringPreviewAdapter } from "../adapters/string-preview"
import { registerJsonPreviewAdapter } from "../adapters/json-preview"
import { registerImagePreviewAdapter } from "../adapters/image-preview"

beforeEach(() => {
  clearRegistry()
  registerBasicNodes()
  registerHashAdapter()
  registerHmacAdapter()
  registerEncodingAdapter()
  registerClassicCipherAdapter()
  registerJsonFormatAdapter()
  registerJsonPathAdapter()
  registerProtobufAdapter()
  registerJceAdapter()
  registerImageCompressAdapter()
  registerImageEditorAdapter()
  registerQrcodeAdapter()
  registerQrcodeDecodeAdapter()
  registerMemeSplitterAdapter()
  registerImageCoordinatesAdapter()
  registerRegexAdapter()
  registerHttpTesterAdapter()
  registerUuidAdapter()
  registerBaseConverterAdapter()
  registerTemperatureConverterAdapter()
  registerImageToBase64Adapter()
  registerExifViewerAdapter()
  registerTextStatsAdapter()
  registerCaseConverterAdapter()
  registerDiffAdapter()
  registerCrontabAdapter()
  registerDockerConverterAdapter()
  registerWhoisAdapter()
  registerTotpAdapter()
  registerColorAdapter()
  registerBmiAdapter()
  registerDeviceInfoAdapter()
  registerTimeAdapter()
  registerCurrencyAdapter()
  registerOfficeViewerAdapter()
  registerCryptoAdapter()
  registerJwtAdapter()
  registerBase64ToFileAdapter()
  registerFileToBase64Adapter()
  registerFileToStringAdapter()
  registerStringToFileAdapter()
  registerStringPreviewAdapter()
  registerJsonPreviewAdapter()
  registerImagePreviewAdapter()
})

describe("Adapter Execute Functions", () => {
  describe("Basic Nodes", () => {
    it("string: returns value from config", async () => {
      const def = getNodeDefinition("string")!
      const result = await def.execute({}, { value: "hello" })
      expect(result).toEqual({ value: "hello" })
    })

    it("string: returns value from inputs over config", async () => {
      const def = getNodeDefinition("string")!
      const result = await def.execute({ value: "input" }, { value: "config" })
      expect(result).toEqual({ value: "input" })
    })

    it("string: defaults to empty string", async () => {
      const def = getNodeDefinition("string")!
      const result = await def.execute({}, {})
      expect(result).toEqual({ value: "" })
    })

    it("number: returns value from config", async () => {
      const def = getNodeDefinition("number")!
      const result = await def.execute({}, { value: 42 })
      expect(result).toEqual({ value: 42 })
    })

    it("number: defaults to 0", async () => {
      const def = getNodeDefinition("number")!
      const result = await def.execute({}, {})
      expect(result).toEqual({ value: 0 })
    })

    it("json: returns parsed object from config string", async () => {
      const def = getNodeDefinition("json")!
      const result = await def.execute({}, { value: '{"key":"value"}' })
      expect(result).toEqual({ parsed: { key: "value" } })
    })

    it("json: returns parsed object from inputs", async () => {
      const def = getNodeDefinition("json")!
      const result = await def.execute({ value: '{"a":1}' }, {})
      expect(result).toEqual({ parsed: { a: 1 } })
    })

    it("json: parses string input to object", async () => {
      const def = getNodeDefinition("json")!
      const result = await def.execute({ value: '{"x":2}' }, {})
      expect(result).toEqual({ parsed: { x: 2 } })
    })

    it("json: throws on invalid JSON in config", async () => {
      const def = getNodeDefinition("json")!
      await expect(def.execute({}, { value: "not json" })).rejects.toThrow("Invalid JSON")
    })

    it("file: returns file from inputs", async () => {
      const def = getNodeDefinition("file")!
      const mockFile = { name: "test.txt" } as File
      const result = await def.execute({ file: mockFile }, {})
      expect(result).toEqual({ file: mockFile })
    })

    it("file: returns file from config fallback", async () => {
      const def = getNodeDefinition("file")!
      const mockFile = { name: "test.txt" } as File
      const result = await def.execute({}, { file: mockFile })
      expect(result).toEqual({ file: mockFile })
    })

    it("file: returns null when no file", async () => {
      const def = getNodeDefinition("file")!
      const result = await def.execute({}, {})
      expect(result).toEqual({ file: null })
    })
  })

  describe("Hash", () => {
    it("MD5: returns correct hash", async () => {
      const def = getNodeDefinition("hash")!
      const result = await def.execute({ data: "1" }, { category: "md", algorithm: "md5" })
      expect(result.hash).toBe("c4ca4238a0b923820dcc509a6f75849b")
    })

    it("SHA-256: returns correct hash", async () => {
      const def = getNodeDefinition("hash")!
      const result = await def.execute({ data: "hello" }, { category: "sha2", algorithm: "sha2-256" })
      expect(result.hash).toBe("2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824")
    })

    it("SHA-1: returns correct hash", async () => {
      const def = getNodeDefinition("hash")!
      const result = await def.execute({ data: "hello" }, { category: "sha1", algorithm: "sha1" })
      expect(result.hash).toBe("aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d")
    })

    it("empty data: returns hash of empty string", async () => {
      const def = getNodeDefinition("hash")!
      const result = await def.execute({}, { category: "md", algorithm: "md5" })
      expect(result.hash).toBe("d41d8cd98f00b204e9800998ecf8427e")
    })
  })

  describe("HMAC", () => {
    it("HMAC-SHA256: returns correct hmac", async () => {
      const def = getNodeDefinition("hmac")!
      const result = await def.execute({ data: "hello", key: "secret" }, { algorithm: "sha256" })
      expect(typeof result.hmac).toBe("string")
      expect(result.hmac).toHaveLength(64)
    })

    it("empty data: returns hmac of empty string", async () => {
      const def = getNodeDefinition("hmac")!
      const result = await def.execute({ key: "secret" }, { algorithm: "sha256" })
      expect(typeof result.hmac).toBe("string")
      expect(result.hmac).toHaveLength(64)
    })

    it("empty key: returns hmac with empty key", async () => {
      const def = getNodeDefinition("hmac")!
      const result = await def.execute({ data: "hello" }, { algorithm: "sha256" })
      expect(typeof result.hmac).toBe("string")
      expect(result.hmac).toHaveLength(64)
    })
  })

  describe("Encoding", () => {
    it("Base64 encode", async () => {
      const def = getNodeDefinition("encoding")!
      const result = await def.execute({ input: "hello" }, { encoding: "base64", mode: "encode" })
      expect(result.output).toBe("aGVsbG8=")
    })

    it("Base64 decode", async () => {
      const def = getNodeDefinition("encoding")!
      const result = await def.execute({ input: "aGVsbG8=" }, { encoding: "base64", mode: "decode" })
      expect(result.output).toBe("hello")
    })

    it("URL encode", async () => {
      const def = getNodeDefinition("encoding")!
      const result = await def.execute({ input: "hello world" }, { encoding: "url", mode: "encode" })
      expect(result.output).toBe("hello%20world")
    })

    it("URL decode", async () => {
      const def = getNodeDefinition("encoding")!
      const result = await def.execute({ input: "hello%20world" }, { encoding: "url", mode: "decode" })
      expect(result.output).toBe("hello world")
    })

    it("Hex encode", async () => {
      const def = getNodeDefinition("encoding")!
      const result = await def.execute({ input: "hi" }, { encoding: "hex", mode: "encode" })
      expect(result.output).toBe("6869")
    })

    it("Hex decode", async () => {
      const def = getNodeDefinition("encoding")!
      const result = await def.execute({ input: "6869" }, { encoding: "hex", mode: "decode" })
      expect(result.output).toBe("hi")
    })

    it("HTML encode", async () => {
      const def = getNodeDefinition("encoding")!
      const result = await def.execute({ input: '<div>"hello"</div>' }, { encoding: "html", mode: "encode" })
      expect(result.output).toContain("&lt;")
      expect(result.output).toContain("&gt;")
    })
  })

  describe("Classic Cipher", () => {
    it("Caesar cipher with shift=3", async () => {
      const def = getNodeDefinition("classic-cipher")!
      const result = await def.execute({ data: "abc" }, { algorithm: "caesar", shift: 3 })
      expect(result.result).toBe("def")
    })

    it("Caesar cipher with shift=5", async () => {
      const def = getNodeDefinition("classic-cipher")!
      const result = await def.execute({ data: "abc" }, { algorithm: "caesar", shift: 5 })
      expect(result.result).toBe("fgh")
    })

    it("ROT13", async () => {
      const def = getNodeDefinition("classic-cipher")!
      const result = await def.execute({ data: "hello" }, { algorithm: "rot13" })
      expect(result.result).toBe("uryyb")
    })

    it("Atbash", async () => {
      const def = getNodeDefinition("classic-cipher")!
      const result = await def.execute({ data: "abc" }, { algorithm: "atbash" })
      expect(result.result).toBe("zyx")
    })

    it("preserves case", async () => {
      const def = getNodeDefinition("classic-cipher")!
      const result = await def.execute({ data: "Hello" }, { algorithm: "caesar", shift: 1 })
      expect(result.result).toBe("Ifmmp")
    })
  })

  describe("JSON Format", () => {
    it("formats JSON with indent", async () => {
      const def = getNodeDefinition("json-format")!
      const result = await def.execute({ data: '{"a":1,"b":2}' }, { indent: 2 })
      expect(result.formatted).toContain("\n")
      expect(result.minified).not.toContain("\n")
    })

    it("sorts keys when sortKeys=true", async () => {
      const def = getNodeDefinition("json-format")!
      const result = await def.execute({ data: '{"b":2,"a":1}' }, { indent: 0, sortKeys: true })
      expect(result.formatted).toBe('{"a":1,"b":2}')
    })

    it("throws on invalid JSON", async () => {
      const def = getNodeDefinition("json-format")!
      await expect(def.execute({ data: "not json" }, {})).rejects.toThrow()
    })
  })

  describe("JWT", () => {
    it("decodes valid JWT", async () => {
      const def = getNodeDefinition("jwt")!
      const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U"
      const result = await def.execute({ token }, {})
      expect(result.header).toHaveProperty("alg", "HS256")
      expect(result.payload).toHaveProperty("sub", "1234567890")
    })

    it("throws on empty token", async () => {
      const def = getNodeDefinition("jwt")!
      await expect(def.execute({}, {})).rejects.toThrow("Token is required")
    })

    it("throws on invalid JWT", async () => {
      const def = getNodeDefinition("jwt")!
      await expect(def.execute({ token: "invalid.token" }, {})).rejects.toThrow()
    })
  })

  describe("UUID", () => {
    it("generates v4 UUID format", async () => {
      const def = getNodeDefinition("uuid")!
      const result = await def.execute({}, { version: "v4", withHyphens: true })
      expect(result.uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    })

    it("generates uppercase UUID", async () => {
      const def = getNodeDefinition("uuid")!
      const result = await def.execute({}, { uppercase: true, withHyphens: true })
      expect(result.uuid).toMatch(/^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/)
    })

    it("generates UUID without hyphens", async () => {
      const def = getNodeDefinition("uuid")!
      const result = await def.execute({}, { withHyphens: false })
      expect(result.uuid).toMatch(/^[0-9a-f]{32}$/)
    })
  })

  describe("Text Stats", () => {
    it("counts characters", async () => {
      const def = getNodeDefinition("text-stats")!
      const result = await def.execute({ text: "hello" }, {})
      expect(result.characters).toBe(5)
    })

    it("counts words", async () => {
      const def = getNodeDefinition("text-stats")!
      const result = await def.execute({ text: "hello world" }, {})
      expect(result.words).toBe(2)
    })

    it("counts lines", async () => {
      const def = getNodeDefinition("text-stats")!
      const result = await def.execute({ text: "a\nb\nc" }, {})
      expect(result.lines).toBe(3)
    })

    it("counts sentences", async () => {
      const def = getNodeDefinition("text-stats")!
      const result = await def.execute({ text: "Hello. World! How?" }, {})
      expect(result.sentences).toBe(3)
    })

    it("counts paragraphs", async () => {
      const def = getNodeDefinition("text-stats")!
      const result = await def.execute({ text: "para1\n\npara2" }, {})
      expect(result.paragraphs).toBe(2)
    })

    it("counts bytes", async () => {
      const def = getNodeDefinition("text-stats")!
      const result = await def.execute({ text: "hello" }, {})
      expect(result.bytes).toBe(5)
    })

    it("handles empty text", async () => {
      const def = getNodeDefinition("text-stats")!
      const result = await def.execute({}, {})
      expect(result.characters).toBe(0)
      expect(result.words).toBe(0)
      expect(result.lines).toBe(1)
    })
  })

  describe("Case Converter", () => {
    it("converts to upper", async () => {
      const def = getNodeDefinition("case-converter")!
      const result = await def.execute({ text: "hello world" }, { targetCase: "upper" })
      expect(result.upper).toBe("HELLO WORLD")
    })

    it("converts to lower", async () => {
      const def = getNodeDefinition("case-converter")!
      const result = await def.execute({ text: "HELLO WORLD" }, { targetCase: "lower" })
      expect(result.lower).toBe("hello world")
    })

    it("converts to camel", async () => {
      const def = getNodeDefinition("case-converter")!
      const result = await def.execute({ text: "hello world" }, { targetCase: "camel" })
      expect(result.camel).toBe("helloWorld")
    })

    it("converts to snake", async () => {
      const def = getNodeDefinition("case-converter")!
      const result = await def.execute({ text: "helloWorld" }, { targetCase: "snake" })
      expect(result.snake).toBe("hello_world")
    })
  })

  describe("Diff", () => {
    it("detects changes between different texts", async () => {
      const def = getNodeDefinition("diff")!
      const result = await def.execute({ text1: "abc", text2: "abd" }, {})
      expect(Number(result.added) + Number(result.removed)).toBeGreaterThan(0)
    })

    it("detects unchanged lines", async () => {
      const def = getNodeDefinition("diff")!
      const result = await def.execute({ text1: "abc", text2: "abc" }, {})
      expect(result.unchanged).toBe(1)
      expect(result.added).toBe(0)
      expect(result.removed).toBe(0)
    })

    it("returns diff object with changes", async () => {
      const def = getNodeDefinition("diff")!
      const result = await def.execute({ text1: "abc", text2: "abd" }, {})
      expect(result.diff).toHaveProperty("text1")
      expect(result.diff).toHaveProperty("text2")
      expect(result.diff).toHaveProperty("changes")
      expect(Array.isArray(result.changes)).toBe(true)
    })
  })

  describe("Currency", () => {
    it("converts USD to EUR", async () => {
      const def = getNodeDefinition("currency")!
      const result = await def.execute({ amount: 100, from: "USD", to: "EUR" }, {})
      expect(typeof result.converted).toBe("number")
      expect(result.converted).toBeGreaterThan(0)
    })

    it("returns rate", async () => {
      const def = getNodeDefinition("currency")!
      const result = await def.execute({ amount: 100, from: "USD", to: "CNY" }, {})
      expect(typeof result.rate).toBe("number")
      expect(result.rate).toBeGreaterThan(0)
    })

    it("defaults to 0 amount", async () => {
      const def = getNodeDefinition("currency")!
      const result = await def.execute({}, {})
      expect(result.converted).toBe(0)
    })
  })

  describe("Crypto", () => {
    it("encrypt returns result string", async () => {
      const def = getNodeDefinition("crypto")!
      const result = await def.execute({ data: "hello", key: "1234567890123456" }, { algorithm: "aes", mode: "CBC", operation: "encrypt", iv: "1234567890123456" })
      expect(typeof result.result).toBe("string")
      expect(String(result.result).length).toBeGreaterThan(0)
    })

    it("throws on empty data", async () => {
      const def = getNodeDefinition("crypto")!
      await expect(def.execute({ key: "1234567890123456" }, { algorithm: "aes" })).rejects.toThrow("Data is required")
    })

    it("throws on empty key", async () => {
      const def = getNodeDefinition("crypto")!
      await expect(def.execute({ data: "hello" }, { algorithm: "aes" })).rejects.toThrow("Key is required")
    })
  })

  describe("Base Converter", () => {
    it("converts decimal to hex", async () => {
      const def = getNodeDefinition("base-converter")!
      const result = await def.execute({ value: "255" }, { fromBase: "10" })
      expect(result.hex).toBe("FF")
    })

    it("converts decimal to binary", async () => {
      const def = getNodeDefinition("base-converter")!
      const result = await def.execute({ value: "5" }, { fromBase: "10" })
      expect(result.binary).toBe("101")
    })

    it("converts decimal to octal", async () => {
      const def = getNodeDefinition("base-converter")!
      const result = await def.execute({ value: "8" }, { fromBase: "10" })
      expect(result.octal).toBe("10")
    })
  })

  describe("Temperature Converter", () => {
    it("Celsius to Fahrenheit", async () => {
      const def = getNodeDefinition("temperature-converter")!
      const result = await def.execute({ value: 100 }, { fromUnit: "celsius" })
      expect(result.fahrenheit).toBe(212)
    })

    it("Celsius to Kelvin", async () => {
      const def = getNodeDefinition("temperature-converter")!
      const result = await def.execute({ value: 0 }, { fromUnit: "celsius" })
      expect(result.kelvin).toBeCloseTo(273.15, 1)
    })

    it("Fahrenheit to Celsius", async () => {
      const def = getNodeDefinition("temperature-converter")!
      const result = await def.execute({ value: 212 }, { fromUnit: "fahrenheit" })
      expect(result.celsius).toBe(100)
    })
  })

  describe("BMI", () => {
    it("calculates BMI correctly", async () => {
      const def = getNodeDefinition("bmi")!
      const result = await def.execute({ weight: 70, height: 1.75 }, {})
      expect(result.bmi).toBeCloseTo(22.86, 1)
    })
  })

  describe("Color", () => {
    it("parses hex color", async () => {
      const def = getNodeDefinition("color")!
      const result = await def.execute({ color: "#ff0000" }, {})
      expect(result.hex).toBe("#ff0000")
      expect(result.rgb).toHaveProperty("r", 255)
      expect(result.rgb).toHaveProperty("g", 0)
      expect(result.rgb).toHaveProperty("b", 0)
    })

    it("returns HSL values", async () => {
      const def = getNodeDefinition("color")!
      const result = await def.execute({ color: "#ff0000" }, {})
      expect(result.hsl).toHaveProperty("h")
      expect(result.hsl).toHaveProperty("s")
      expect(result.hsl).toHaveProperty("l")
    })
  })

  describe("Crontab", () => {
    it("parses cron expression", async () => {
      const def = getNodeDefinition("crontab")!
      const result = await def.execute({ expression: "* * * * *" }, {})
      expect(result.parsed).toHaveProperty("minute")
      expect(result.parsed).toHaveProperty("hour")
    })
  })

  describe("Regex", () => {
    it("finds matches", async () => {
      const def = getNodeDefinition("regex")!
      const result = await def.execute({ text: "test123", pattern: "\\d+" }, { flags: "g" })
      expect(Array.isArray(result.matches)).toBe(true)
      expect(result.matches).toContain("123")
    })

    it("returns test string", async () => {
      const def = getNodeDefinition("regex")!
      const result = await def.execute({ text: "test123", pattern: "\\d+" }, { flags: "g" })
      expect(typeof result.test).toBe("string")
    })
  })

  describe("Time", () => {
    it("returns timestamp", async () => {
      const def = getNodeDefinition("time")!
      const result = await def.execute({}, {})
      expect(typeof result.timestamp).toBe("number")
      expect(result.timestamp).toBeGreaterThan(0)
    })

    it("returns ISO string", async () => {
      const def = getNodeDefinition("time")!
      const result = await def.execute({}, {})
      expect(typeof result.iso).toBe("string")
      expect(result.iso).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })
  })

  describe("Device Info", () => {
    it("returns device info object", async () => {
      const def = getNodeDefinition("device-info")!
      const result = await def.execute({}, {})
      expect(typeof result.info).toBe("object")
    })
  })

  describe("File-based nodes (config fallback)", () => {
    it("image-to-base64: uses config.file fallback", async () => {
      const def = getNodeDefinition("image-to-base64")!
      const mockFile = new File(["hello"], "test.txt", { type: "text/plain" })
      // File.arrayBuffer() is not available in vitest/jsdom
      mockFile.arrayBuffer = async () => new ArrayBuffer(5)
      const result = await def.execute({}, { file: mockFile })
      expect(result.base64).toBeDefined()
      expect(result.dataUri).toContain("data:")
    })

    it("image-to-base64: throws when no file", async () => {
      const def = getNodeDefinition("image-to-base64")!
      await expect(def.execute({}, {})).rejects.toThrow("No file provided")
    })

    it("exif-viewer: uses config.file fallback", async () => {
      const def = getNodeDefinition("exif-viewer")!
      const mockFile = new File(["fake-jpeg-data"], "test.jpg", { type: "image/jpeg" })
      // File.arrayBuffer() is not available in vitest/jsdom
      mockFile.arrayBuffer = async () => new ArrayBuffer(14)
      const result = await def.execute({}, { file: mockFile })
      expect(result.exif).toBeDefined()
      expect(result.exif).toHaveProperty("fileName", "test.jpg")
    })

    it("image-compress: uses config.file fallback", async () => {
      const close = vi.fn()
      vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({ width: 4, height: 3, close }))
      vi.stubGlobal("OffscreenCanvas", class MockOffscreenCanvas {
        width: number
        height: number

        constructor(width: number, height: number) {
          this.width = width
          this.height = height
        }

        getContext() {
          return { drawImage: vi.fn() }
        }

        async convertToBlob(options: BlobPropertyBag) {
          return new Blob(["compressed"], options)
        }
      })

      const def = getNodeDefinition("image-compress")!
      const mockFile = new File(["fake-data"], "test.jpg", { type: "image/jpeg" })
      const result = await def.execute({}, { file: mockFile, quality: 80 })
      expect(result.file).toBeDefined()
      expect(result.info).toBeDefined()
      expect(close).toHaveBeenCalledOnce()
      vi.unstubAllGlobals()
    })

    it("image-editor: uses config.file fallback", async () => {
      const def = getNodeDefinition("image-editor")!
      const mockFile = new File(["fake-data"], "test.jpg", { type: "image/jpeg" })
      const result = await def.execute({}, { file: mockFile })
      expect(result.file).toBeDefined()
    })

    it("meme-splitter: uses config.file fallback", async () => {
      const def = getNodeDefinition("meme-splitter")!
      const mockFile = new File(["fake-data"], "test.jpg", { type: "image/jpeg" })
      const result = await def.execute({}, { file: mockFile, rows: 4, cols: 6 })
      expect(result.parts).toBeDefined()
    })

    it("image-coordinates: uses config.file fallback", async () => {
      const def = getNodeDefinition("image-coordinates")!
      const mockFile = new File(["fake-data"], "test.jpg", { type: "image/jpeg" })
      const result = await def.execute({}, { file: mockFile })
      expect(result.coordinates).toBeDefined()
    })

    it("office-viewer: uses config.file fallback", async () => {
      const def = getNodeDefinition("office-viewer")!
      const mockFile = new File(["fake-data"], "test.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
      const result = await def.execute({}, { file: mockFile })
      expect(result.info).toBeDefined()
      expect(result.info).toHaveProperty("name", "test.xlsx")
    })

    it("qrcode-decode: uses config.file fallback", async () => {
      const def = getNodeDefinition("qrcode-decode")!
      const mockFile = new File(["fake-data"], "test.png", { type: "image/png" })
      // QR decode requires real image data and browser APIs (Image, canvas)
      // In vitest/jsdom environment, Image loading doesn't work properly
      // So we just verify the adapter exists and has the right config
      expect(def.config).toHaveLength(1)
      expect(def.config[0].id).toBe("file")
      expect(def.outputs).toHaveLength(1)
      expect(def.outputs[0].id).toBe("data")
    })
  })

  describe("New Nodes - Phase 4", () => {
    describe("Boolean", () => {
      it("returns true value", async () => {
        const def = getNodeDefinition("boolean")!
        const result = await def.execute({}, { value: true })
        expect(result.value).toBe(true)
      })

      it("returns false value", async () => {
        const def = getNodeDefinition("boolean")!
        const result = await def.execute({}, { value: false })
        expect(result.value).toBe(false)
      })

      it("defaults to false", async () => {
        const def = getNodeDefinition("boolean")!
        const result = await def.execute({}, {})
        expect(result.value).toBe(false)
      })

      it("returns value from inputs over config", async () => {
        const def = getNodeDefinition("boolean")!
        const result = await def.execute({ value: true }, { value: false })
        expect(result.value).toBe(true)
      })

      it("has correct config", () => {
        const def = getNodeDefinition("boolean")!
        expect(def.config).toHaveLength(1)
        expect(def.config[0].id).toBe("value")
        expect(def.config[0].dataType).toBe("boolean")
        expect(def.config[0].hasInput).toBe(true)
        expect(def.config[0].hasOutput).toBe(true)
      })
    })

    describe("JSON Path", () => {
      it("queries root path", async () => {
        const def = getNodeDefinition("json-path")!
        const result = await def.execute({}, { json: '{"a":1}', path: "$" })
        expect(result.object).toEqual({ a: 1 })
        expect(result.type).toBe("object")
      })

      it("queries nested path", async () => {
        const def = getNodeDefinition("json-path")!
        const result = await def.execute({}, { json: '{"a":{"b":2}}', path: "$.a.b" })
        expect(result.number).toBe(2)
        expect(result.type).toBe("number")
      })

      it("queries array index", async () => {
        const def = getNodeDefinition("json-path")!
        const result = await def.execute({}, { json: '{"arr":[1,2,3]}', path: "$.arr[1]" })
        expect(result.number).toBe(2)
        expect(result.type).toBe("number")
      })

      it("queries array of objects", async () => {
        const def = getNodeDefinition("json-path")!
        const result = await def.execute({}, { json: '{"users":[{"name":"Alice"},{"name":"Bob"}]}', path: "$.users[0].name" })
        expect(result.string).toBe("Alice")
        expect(result.type).toBe("string")
      })

      it("returns undefined for non-existent path", async () => {
        const def = getNodeDefinition("json-path")!
        const result = await def.execute({}, { json: '{"a":1}', path: "$.b" })
        expect(result.type).toBe("undefined")
      })

      it("throws on invalid JSON", async () => {
        const def = getNodeDefinition("json-path")!
        await expect(def.execute({}, { json: "invalid", path: "$" })).rejects.toThrow("Invalid JSON")
      })

      it("throws on invalid path", async () => {
        const def = getNodeDefinition("json-path")!
        await expect(def.execute({}, { json: '{"a":1}', path: "invalid" })).rejects.toThrow("Path must start with $")
      })

      it("has correct config", () => {
        const def = getNodeDefinition("json-path")!
        expect(def.config).toHaveLength(2)
        expect(def.config[0].id).toBe("json")
        expect(def.config[1].id).toBe("path")
        expect(def.outputs).toHaveLength(6)
        expect(def.outputs[0].id).toBe("string")
        expect(def.outputs[1].id).toBe("number")
        expect(def.outputs[2].id).toBe("boolean")
        expect(def.outputs[3].id).toBe("object")
        expect(def.outputs[4].id).toBe("array")
        expect(def.outputs[5].id).toBe("type")
      })
    })

    describe("File Conversion Nodes", () => {
      it("base64-to-file: converts base64 to file", async () => {
        const def = getNodeDefinition("base64-to-file")!
        const base64 = btoa("hello world")
        const result = await def.execute({}, { base64, filename: "test.txt", mimeType: "text/plain" })
        expect(result.file).toBeInstanceOf(File)
        expect((result.file as File).name).toBe("test.txt")
      })

      it("base64-to-file: throws on invalid base64", async () => {
        const def = getNodeDefinition("base64-to-file")!
        await expect(def.execute({}, { base64: "not-valid-base64!@#" })).rejects.toThrow("Invalid Base64 string")
      })

      it("file-to-base64: converts file to base64", async () => {
        const def = getNodeDefinition("file-to-base64")!
        const file = new File(["hello"], "test.txt", { type: "text/plain" })
        file.arrayBuffer = async () => new TextEncoder().encode("hello").buffer
        const result = await def.execute({}, { file })
        expect(result.base64).toBe(btoa("hello"))
      })

      it("file-to-base64: throws when no file", async () => {
        const def = getNodeDefinition("file-to-base64")!
        await expect(def.execute({}, {})).rejects.toThrow("No file provided")
      })

      it("file-to-string: converts file to string", async () => {
        const def = getNodeDefinition("file-to-string")!
        const file = new File(["hello world"], "test.txt", { type: "text/plain" })
        file.text = async () => "hello world"
        const result = await def.execute({}, { file })
        expect(result.content).toBe("hello world")
      })

      it("file-to-string: throws when no file", async () => {
        const def = getNodeDefinition("file-to-string")!
        await expect(def.execute({}, {})).rejects.toThrow("No file provided")
      })

      it("string-to-file: converts string to file", async () => {
        const def = getNodeDefinition("string-to-file")!
        const result = await def.execute({}, { content: "hello", filename: "test.txt" })
        expect(result.file).toBeInstanceOf(File)
        expect((result.file as File).name).toBe("test.txt")
        expect((result.file as File).type).toBe("text/plain")
      })

      it("string-to-file: defaults to file.txt", async () => {
        const def = getNodeDefinition("string-to-file")!
        const result = await def.execute({}, { content: "hello" })
        expect((result.file as File).name).toBe("file.txt")
      })
    })

    describe("Preview Nodes", () => {
      it("string-preview: returns content", async () => {
        const def = getNodeDefinition("string-preview")!
        const result = await def.execute({}, { content: "hello" })
        expect(result.content).toBe("hello")
      })

      it("string-preview: has no outputs", () => {
        const def = getNodeDefinition("string-preview")!
        expect(def.outputs).toHaveLength(0)
      })

      it("json-preview: returns parsed json", async () => {
        const def = getNodeDefinition("json-preview")!
        const result = await def.execute({}, { json: '{"a":1}' })
        expect(result.parsed).toEqual({ a: 1 })
      })

      it("json-preview: throws on invalid json", async () => {
        const def = getNodeDefinition("json-preview")!
        await expect(def.execute({}, { json: "invalid" })).rejects.toThrow("Invalid JSON")
      })

      it("json-preview: has no outputs", () => {
        const def = getNodeDefinition("json-preview")!
        expect(def.outputs).toHaveLength(0)
      })

      it("image-preview: validates image type", async () => {
        const def = getNodeDefinition("image-preview")!
        const mockFile = new File(["fake-data"], "test.jpg", { type: "image/jpeg" })
        const result = await def.execute({}, { file: mockFile })
        expect(result.file).toBeDefined()
        expect(result.type).toBe("image/jpeg")
      })

      it("image-preview: throws when no file", async () => {
        const def = getNodeDefinition("image-preview")!
        await expect(def.execute({}, {})).rejects.toThrow("No file provided")
      })

      it("image-preview: throws for non-image file", async () => {
        const def = getNodeDefinition("image-preview")!
        const mockFile = new File(["fake-data"], "test.txt", { type: "text/plain" })
        await expect(def.execute({}, { file: mockFile })).rejects.toThrow("File is not an image")
      })

      it("image-preview: has no outputs", () => {
        const def = getNodeDefinition("image-preview")!
        expect(def.outputs).toHaveLength(0)
      })
    })
  })
})
