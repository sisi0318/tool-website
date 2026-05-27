import { Smartphone } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"

export const deviceInfoAdapter: ToolAdapter = {
  type: "device-info",
  category: "viewer",
  label: "Device Info",
  icon: Smartphone,
  inputs: [],
  outputs: [
    { id: "info", name: "Info", dataType: "json" },
  ],
  config: [],
  async execute(inputs, config) {
    if (typeof window === "undefined") {
      return {
        info: { note: "Device info requires browser environment" },
      }
    }

    return {
      info: {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        cookiesEnabled: navigator.cookieEnabled,
        onLine: navigator.onLine,
        screen: {
          width: screen.width,
          height: screen.height,
          colorDepth: screen.colorDepth,
          pixelDepth: screen.pixelDepth,
        },
        window: {
          innerWidth: window.innerWidth,
          innerHeight: window.innerHeight,
          outerWidth: window.outerWidth,
          outerHeight: window.outerHeight,
        },
      },
    }
  },
}

export function registerDeviceInfoAdapter(): void {
  registerNode(deviceInfoAdapter)
}
