import { Network } from "lucide-react"

import { registerNode } from "../canvas/registry"
import { calculateSubnet } from "../subnet-tools"
import type { ToolAdapter } from "./types"

export const subnetAdapter: ToolAdapter = {
  type: "subnet",
  category: "dev",
  label: "IP / CIDR",
  description: "Calculate IPv4 and IPv6 network ranges and test address membership",
  icon: Network,
  config: [
    { id: "cidr", name: "IP or CIDR", dataType: "string", defaultValue: "192.168.1.10/24", hasInput: true },
    { id: "probe", name: "Address to check", dataType: "string", defaultValue: "", hasInput: true },
  ],
  outputs: [
    { id: "result", name: "Subnet details", dataType: "json" },
    { id: "network", name: "Network", dataType: "string" },
    { id: "firstAddress", name: "First address", dataType: "string" },
    { id: "lastAddress", name: "Last address", dataType: "string" },
    { id: "totalAddresses", name: "Total addresses", dataType: "string" },
    { id: "contains", name: "Contains address", dataType: "boolean" },
  ],
  async execute(inputs, config) {
    const result = calculateSubnet(String(inputs.cidr ?? config.cidr ?? ""), String(inputs.probe ?? config.probe ?? ""))
    return { result, network: result.network, firstAddress: result.firstAddress, lastAddress: result.lastAddress, totalAddresses: result.totalAddresses, contains: result.contains ?? false }
  },
}

export function registerSubnetAdapter(): void {
  registerNode(subnetAdapter)
}
