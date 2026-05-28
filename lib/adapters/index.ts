import { registerBasicNodes } from "./basic"
import { registerHashAdapter } from "./hash"
import { registerHashVerifyAdapter } from "./hash-verify"
import { registerHmacAdapter } from "./hmac"
import { registerHmacVerifyAdapter } from "./hmac-verify"
import { registerCryptoAdapter } from "./crypto"
import { registerEncodingAdapter } from "./encoding"
import { registerClassicCipherAdapter } from "./classic-cipher"
import { registerJwtAdapter } from "./jwt"
import { registerJsonFormatAdapter } from "./json-format"
import { registerJsonPathAdapter } from "./json-path"
import { registerJsonStringifyAdapter } from "./json-stringify"
import { registerJsonParseAdapter } from "./json-parse"
import { registerJsonToYamlAdapter } from "./json-to-yaml"
import { registerYamlToJsonAdapter } from "./yaml-to-json"
import { registerProtobufAdapter } from "./protobuf"
import { registerJceAdapter } from "./jce"
import { registerImageToBase64Adapter } from "./image-to-base64"
import { registerExifViewerAdapter } from "./exif-viewer"
import { registerImageCompressAdapter } from "./image-compress"
import { registerImageEditorAdapter } from "./image-editor"
import { registerQrcodeAdapter } from "./qrcode"
import { registerQrcodeDecodeAdapter } from "./qrcode-decode"
import { registerMemeSplitterAdapter } from "./meme-splitter"
import { registerImageCoordinatesAdapter } from "./image-coordinates"
import { registerTextStatsAdapter } from "./text-stats"
import { registerCaseConverterAdapter } from "./case-converter"
import { registerRegexAdapter } from "./regex"
import { registerDiffAdapter } from "./diff"
import { registerHttpTesterAdapter } from "./http-tester"
import { registerCrontabAdapter } from "./crontab"
import { registerDockerConverterAdapter } from "./docker-converter"
import { registerWhoisAdapter } from "./whois"
import { registerUuidAdapter } from "./uuid"
import { registerTotpAdapter } from "./totp"
import { registerColorAdapter } from "./color"
import { registerBaseConverterAdapter } from "./base-converter"
import { registerTemperatureConverterAdapter } from "./temperature-converter"
import { registerCurrencyAdapter } from "./currency"
import { registerBmiAdapter } from "./bmi"
import { registerDeviceInfoAdapter } from "./device-info"
import { registerOfficeViewerAdapter } from "./office-viewer"
import { registerTimeAdapter } from "./time"
import { registerBase64ToFileAdapter } from "./base64-to-file"
import { registerFileToBase64Adapter } from "./file-to-base64"
import { registerFileToStringAdapter } from "./file-to-string"
import { registerStringToFileAdapter } from "./string-to-file"
import { registerStringPreviewAdapter } from "./string-preview"
import { registerJsonPreviewAdapter } from "./json-preview"
import { registerImagePreviewAdapter } from "./image-preview"
import { registerNode } from "../canvas/registry"
import type { ToolAdapter } from "./types"

export type { ToolAdapter }

function safeRegister(name: string, fn: () => void): void {
  try {
    fn()
  } catch (e) {
    console.warn(`[canvas] Failed to register adapter "${name}":`, e)
  }
}

export function registerAllAdapters(): void {
  // Basic (5)
  safeRegister("basic", registerBasicNodes)

  // Crypto (8)
  safeRegister("hash", registerHashAdapter)
  safeRegister("hash-verify", registerHashVerifyAdapter)
  safeRegister("hmac", registerHmacAdapter)
  safeRegister("hmac-verify", registerHmacVerifyAdapter)
  safeRegister("crypto", registerCryptoAdapter)
  safeRegister("encoding", registerEncodingAdapter)
  safeRegister("classic-cipher", registerClassicCipherAdapter)
  safeRegister("jwt", registerJwtAdapter)

  // Data (12)
  safeRegister("json-format", registerJsonFormatAdapter)
  safeRegister("json-path", registerJsonPathAdapter)
  safeRegister("json-stringify", registerJsonStringifyAdapter)
  safeRegister("json-parse", registerJsonParseAdapter)
  safeRegister("json-to-yaml", registerJsonToYamlAdapter)
  safeRegister("yaml-to-json", registerYamlToJsonAdapter)
  safeRegister("protobuf", registerProtobufAdapter)
  safeRegister("jce", registerJceAdapter)
  safeRegister("base64-to-file", registerBase64ToFileAdapter)
  safeRegister("file-to-base64", registerFileToBase64Adapter)
  safeRegister("file-to-string", registerFileToStringAdapter)
  safeRegister("string-to-file", registerStringToFileAdapter)

  // Image (8)
  safeRegister("image-to-base64", registerImageToBase64Adapter)
  safeRegister("exif-viewer", registerExifViewerAdapter)
  safeRegister("image-compress", registerImageCompressAdapter)
  safeRegister("image-editor", registerImageEditorAdapter)
  safeRegister("qrcode", registerQrcodeAdapter)
  safeRegister("qrcode-decode", registerQrcodeDecodeAdapter)
  safeRegister("meme-splitter", registerMemeSplitterAdapter)
  safeRegister("image-coordinates", registerImageCoordinatesAdapter)

  // Text (4)
  safeRegister("text-stats", registerTextStatsAdapter)
  safeRegister("case-converter", registerCaseConverterAdapter)
  safeRegister("regex", registerRegexAdapter)
  safeRegister("diff", registerDiffAdapter)

  // Dev (4)
  safeRegister("http-tester", registerHttpTesterAdapter)
  safeRegister("crontab", registerCrontabAdapter)
  safeRegister("docker-converter", registerDockerConverterAdapter)
  safeRegister("whois", registerWhoisAdapter)

  // Utility (7)
  safeRegister("uuid", registerUuidAdapter)
  safeRegister("totp", registerTotpAdapter)
  safeRegister("color", registerColorAdapter)
  safeRegister("base-converter", registerBaseConverterAdapter)
  safeRegister("temperature-converter", registerTemperatureConverterAdapter)
  safeRegister("currency", registerCurrencyAdapter)
  safeRegister("bmi", registerBmiAdapter)

  // Viewer (6)
  safeRegister("device-info", registerDeviceInfoAdapter)
  safeRegister("office-viewer", registerOfficeViewerAdapter)
  safeRegister("time", registerTimeAdapter)
  safeRegister("string-preview", registerStringPreviewAdapter)
  safeRegister("json-preview", registerJsonPreviewAdapter)
  safeRegister("image-preview", registerImagePreviewAdapter)
}
