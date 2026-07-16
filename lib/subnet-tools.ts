export type IpFamily = "IPv4" | "IPv6"

const ZERO = BigInt(0)
const ONE = BigInt(1)
const BYTE_MASK = BigInt(255)
const GROUP_MASK = BigInt(65535)

interface ParsedAddress {
  family: IpFamily
  bits: 32 | 128
  value: bigint
}

export interface SubnetResult {
  family: IpFamily
  address: string
  prefix: number
  network: string
  netmask: string
  wildcard?: string
  broadcast?: string
  firstAddress: string
  lastAddress: string
  totalAddresses: string
  contains?: boolean
}

function parseIpv4(input: string): ParsedAddress {
  const parts = input.split(".")
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) throw new Error("Invalid IPv4 address")
  const octets = parts.map(Number)
  if (octets.some((part) => part < 0 || part > 255)) throw new Error("Invalid IPv4 address")
  return { family: "IPv4", bits: 32, value: octets.reduce((value, octet) => (value << BigInt(8)) | BigInt(octet), ZERO) }
}

function ipv4TailToGroups(input: string): string {
  const lastColon = input.lastIndexOf(":")
  if (lastColon < 0) throw new Error("Invalid IPv6 address")
  const ipv4 = parseIpv4(input.slice(lastColon + 1)).value
  const ipv6Prefix = input.slice(0, lastColon + 1)
  return `${ipv6Prefix}${(ipv4 >> BigInt(16)).toString(16)}:${(ipv4 & GROUP_MASK).toString(16)}`
}

function parseIpv6(input: string): ParsedAddress {
  const normalized = input.includes(".") ? ipv4TailToGroups(input) : input
  if (normalized.includes("%") || (normalized.match(/::/g)?.length ?? 0) > 1) throw new Error("Invalid IPv6 address")
  const hasCompression = normalized.includes("::")
  const [leftText, rightText = ""] = normalized.split("::")
  const left = leftText ? leftText.split(":") : []
  const right = rightText ? rightText.split(":") : []
  const validGroup = (group: string) => /^[0-9a-fA-F]{1,4}$/.test(group)
  if (left.some((group) => !validGroup(group)) || right.some((group) => !validGroup(group))) throw new Error("Invalid IPv6 address")
  if ((!hasCompression && left.length !== 8) || (hasCompression && left.length + right.length >= 8)) throw new Error("Invalid IPv6 address")
  const groups = hasCompression
    ? [...left, ...Array(8 - left.length - right.length).fill("0"), ...right]
    : left
  const value = groups.reduce((result, group) => (result << BigInt(16)) | BigInt(`0x${group}`), ZERO)
  return { family: "IPv6", bits: 128, value }
}

export function parseIpAddress(input: string): ParsedAddress {
  const value = input.trim()
  if (!value) throw new Error("IP address is required")
  return value.includes(":") ? parseIpv6(value) : parseIpv4(value)
}

function formatIpv4(value: bigint): string {
  return [24, 16, 8, 0].map((shift) => Number((value >> BigInt(shift)) & BYTE_MASK)).join(".")
}

function formatIpv6(value: bigint): string {
  const groups = Array.from({ length: 8 }, (_, index) => Number((value >> BigInt((7 - index) * 16)) & GROUP_MASK).toString(16))
  let bestStart = -1
  let bestLength = 0
  for (let start = 0; start < groups.length;) {
    if (groups[start] !== "0") { start += 1; continue }
    let end = start
    while (end < groups.length && groups[end] === "0") end += 1
    if (end - start > bestLength && end - start >= 2) {
      bestStart = start
      bestLength = end - start
    }
    start = end
  }
  if (bestStart < 0) return groups.join(":")
  const left = groups.slice(0, bestStart).join(":")
  const right = groups.slice(bestStart + bestLength).join(":")
  return `${left}::${right}`
}

function formatAddress(value: bigint, family: IpFamily): string {
  return family === "IPv4" ? formatIpv4(value) : formatIpv6(value)
}

export function calculateSubnet(input: string, probeInput?: string): SubnetResult {
  const trimmed = input.trim()
  const slash = trimmed.lastIndexOf("/")
  const addressText = slash >= 0 ? trimmed.slice(0, slash) : trimmed
  const address = parseIpAddress(addressText)
  const prefixText = slash >= 0 ? trimmed.slice(slash + 1) : String(address.bits)
  if (!/^\d+$/.test(prefixText)) throw new Error("Invalid CIDR prefix")
  const prefix = Number(prefixText)
  if (prefix < 0 || prefix > address.bits) throw new Error(`CIDR prefix must be between 0 and ${address.bits}`)

  const fullMask = (ONE << BigInt(address.bits)) - ONE
  const hostBits = address.bits - prefix
  const hostMask = hostBits === 0 ? ZERO : (ONE << BigInt(hostBits)) - ONE
  const mask = fullMask ^ hostMask
  const network = address.value & mask
  const last = network | hostMask
  const hasReservedEndpoints = address.family === "IPv4" && prefix <= 30
  const firstAddress = hasReservedEndpoints ? network + ONE : network
  const lastAddress = hasReservedEndpoints ? last - ONE : last

  let contains: boolean | undefined
  if (probeInput?.trim()) {
    const probe = parseIpAddress(probeInput)
    if (probe.family !== address.family) contains = false
    else contains = (probe.value & mask) === network
  }

  return {
    family: address.family,
    address: formatAddress(address.value, address.family),
    prefix,
    network: `${formatAddress(network, address.family)}/${prefix}`,
    netmask: formatAddress(mask, address.family),
    ...(address.family === "IPv4" ? { wildcard: formatAddress(hostMask, address.family), broadcast: formatAddress(last, address.family) } : {}),
    firstAddress: formatAddress(firstAddress, address.family),
    lastAddress: formatAddress(lastAddress, address.family),
    totalAddresses: (ONE << BigInt(hostBits)).toString(),
    ...(contains === undefined ? {} : { contains }),
  }
}
