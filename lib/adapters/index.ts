import { registerBasicNodes } from "./basic"
import { registerHashAdapter } from "./hash"
import { registerHmacAdapter } from "./hmac"
import { registerCryptoAdapter } from "./crypto"
import { registerEncodingAdapter } from "./encoding"
import { registerClassicCipherAdapter } from "./classic-cipher"
import { registerJwtAdapter } from "./jwt"
import { registerJsonFormatAdapter } from "./json-format"
import { registerJsonPathAdapter } from "./json-path"
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

export function registerAllAdapters(): void {
  // Basic (5)
  registerBasicNodes()
  
  // Crypto (6)
  registerHashAdapter()
  registerHmacAdapter()
  registerCryptoAdapter()
  registerEncodingAdapter()
  registerClassicCipherAdapter()
  registerJwtAdapter()
  
  // Data (8)
  registerJsonFormatAdapter()
  registerJsonPathAdapter()
  registerProtobufAdapter()
  registerJceAdapter()
  registerBase64ToFileAdapter()
  registerFileToBase64Adapter()
  registerFileToStringAdapter()
  registerStringToFileAdapter()
  
  // Image (8)
  registerImageToBase64Adapter()
  registerExifViewerAdapter()
  registerImageCompressAdapter()
  registerImageEditorAdapter()
  registerQrcodeAdapter()
  registerQrcodeDecodeAdapter()
  registerMemeSplitterAdapter()
  registerImageCoordinatesAdapter()
  
  // Text (4)
  registerTextStatsAdapter()
  registerCaseConverterAdapter()
  registerRegexAdapter()
  registerDiffAdapter()
  
  // Dev (4)
  registerHttpTesterAdapter()
  registerCrontabAdapter()
  registerDockerConverterAdapter()
  registerWhoisAdapter()
  
  // Utility (7)
  registerUuidAdapter()
  registerTotpAdapter()
  registerColorAdapter()
  registerBaseConverterAdapter()
  registerTemperatureConverterAdapter()
  registerCurrencyAdapter()
  registerBmiAdapter()
  
  // Viewer (6)
  registerDeviceInfoAdapter()
  registerOfficeViewerAdapter()
  registerTimeAdapter()
  registerStringPreviewAdapter()
  registerJsonPreviewAdapter()
  registerImagePreviewAdapter()
}
