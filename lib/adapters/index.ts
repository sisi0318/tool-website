import { registerBasicNodes } from "./basic"
import { registerHashAdapter } from "./hash"
import { registerEncodingAdapter } from "./encoding"
import { registerUuidAdapter } from "./uuid"
import { registerBaseConverterAdapter } from "./base-converter"
import { registerTemperatureConverterAdapter } from "./temperature-converter"
import { registerNode } from "../canvas/registry"
import type { ToolAdapter } from "./types"

export type { ToolAdapter }

export function registerAllAdapters(): void {
  registerBasicNodes()
  registerHashAdapter()
  registerEncodingAdapter()
  registerUuidAdapter()
  registerBaseConverterAdapter()
  registerTemperatureConverterAdapter()
}
