export type RdapQueryType = "domain" | "ipv4" | "ipv6" | "auto"

export interface RdapBootstrapRegistry {
  services: Array<[string[], string[]]>
}

const IPV4_PATTERN = /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/

export function isValidIpv6Address(value: string): boolean {
  let address = value.trim()
  if (address.startsWith("[") && address.endsWith("]")) address = address.slice(1, -1)
  address = address.split("%", 1)[0]
  if (!address.includes(":") || address.includes(":::")) return false

  const compressionParts = address.split("::")
  if (compressionParts.length > 2) return false

  const parseGroups = (part: string): number | null => {
    if (!part) return 0
    const groups = part.split(":")
    let count = 0
    for (let index = 0; index < groups.length; index += 1) {
      const group = groups[index]
      if (group.includes(".")) {
        if (index !== groups.length - 1 || !IPV4_PATTERN.test(group)) return null
        count += 2
      } else {
        if (!/^[0-9a-fA-F]{1,4}$/.test(group)) return null
        count += 1
      }
    }
    return count
  }

  const leftCount = parseGroups(compressionParts[0])
  const rightCount = parseGroups(compressionParts[1] ?? "")
  if (leftCount === null || rightCount === null) return false

  const groupCount = leftCount + rightCount
  return compressionParts.length === 2 ? groupCount < 8 : groupCount === 8
}

export function detectRdapQueryType(query: string): RdapQueryType {
  const normalized = normalizeRdapQuery(query)
  if (IPV4_PATTERN.test(normalized)) return "ipv4"
  if (isValidIpv6Address(normalized)) return "ipv6"
  if (normalized.includes(".") && !/\s/.test(normalized)) return "domain"
  return "auto"
}

export function normalizeRdapQuery(query: string): string {
  const trimmed = query.trim()
  if (!trimmed) return ""

  if (isValidIpv6Address(trimmed) || IPV4_PATTERN.test(trimmed)) {
    return trimmed.replace(/^\[|\]$/g, "").split("%", 1)[0]
  }

  try {
    const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
    const hostname = new URL(candidate).hostname.replace(/^\[|\]$/g, "")
    if (hostname) return hostname.replace(/\.$/, "").toLowerCase()
  } catch {
    // Fall through to a conservative hostname cleanup.
  }

  return trimmed
    .replace(/^[a-z][a-z\d+.-]*:\/\//i, "")
    .split(/[/?#]/, 1)[0]
    .replace(/:\d+$/, "")
    .replace(/\.$/, "")
    .toLowerCase()
}

function selectSecureServiceUrl(urls: string[]): string | null {
  const selected = urls.find((url) => url.startsWith("https://")) ?? urls[0]
  if (!selected) return null
  return selected.endsWith("/") ? selected : `${selected}/`
}

export function findDomainRdapServer(
  domain: string,
  registry: RdapBootstrapRegistry,
): string | null {
  const labels = normalizeRdapQuery(domain).split(".").filter(Boolean)
  let bestMatchLength = -1
  let bestUrls: string[] | null = null

  for (const [entries, urls] of registry.services ?? []) {
    for (const entry of entries) {
      const entryLabels = entry.toLowerCase().split(".").filter(Boolean)
      if (entryLabels.length > labels.length) continue
      const offset = labels.length - entryLabels.length
      const matches = entryLabels.every((label, index) => labels[offset + index] === label)
      if (matches && entryLabels.length > bestMatchLength) {
        bestMatchLength = entryLabels.length
        bestUrls = urls
      }
    }
  }

  return bestUrls ? selectSecureServiceUrl(bestUrls) : null
}

function parseIpv4ToBigInt(address: string): bigint | null {
  if (!IPV4_PATTERN.test(address)) return null
  return address.split(".").reduce(
    (result, part) => result * BigInt(256) + BigInt(Number(part)),
    BigInt(0),
  )
}

function parseIpv6ToBigInt(address: string): bigint | null {
  let normalized = address.trim().replace(/^\[|\]$/g, "").split("%", 1)[0].toLowerCase()
  if (!isValidIpv6Address(normalized)) return null

  const ipv4Match = normalized.match(/(\d+\.\d+\.\d+\.\d+)$/)
  if (ipv4Match) {
    const ipv4 = parseIpv4ToBigInt(ipv4Match[1])
    if (ipv4 === null) return null
    const high = Number(ipv4 / BigInt(65536)).toString(16)
    const low = Number(ipv4 % BigInt(65536)).toString(16)
    normalized = normalized.slice(0, -ipv4Match[1].length) + `${high}:${low}`
  }

  const [left = "", right = ""] = normalized.split("::")
  const leftGroups = left ? left.split(":") : []
  const rightGroups = right ? right.split(":") : []
  const missingGroups = 8 - leftGroups.length - rightGroups.length
  const groups = normalized.includes("::")
    ? [...leftGroups, ...Array.from({ length: missingGroups }, () => "0"), ...rightGroups]
    : leftGroups
  if (groups.length !== 8) return null

  return groups.reduce(
    (result, group) => result * BigInt(65536) + BigInt(parseInt(group, 16)),
    BigInt(0),
  )
}

export function findIpRdapServer(
  address: string,
  registry: RdapBootstrapRegistry,
): string | null {
  const normalized = normalizeRdapQuery(address)
  const ipv4 = parseIpv4ToBigInt(normalized)
  const isIpv4 = ipv4 !== null
  const target = ipv4 ?? parseIpv6ToBigInt(normalized)
  if (target === null) return null

  const totalBits = isIpv4 ? 32 : 128
  let bestPrefixLength = -1
  let bestUrls: string[] | null = null

  for (const [prefixes, urls] of registry.services ?? []) {
    for (const cidr of prefixes) {
      const [prefixAddress, prefixText] = cidr.split("/")
      const prefixLength = Number(prefixText)
      if (!Number.isInteger(prefixLength) || prefixLength < 0 || prefixLength > totalBits) continue
      const prefix = isIpv4
        ? parseIpv4ToBigInt(prefixAddress)
        : parseIpv6ToBigInt(prefixAddress)
      if (prefix === null) continue

      const shift = BigInt(totalBits - prefixLength)
      if ((target >> shift) === (prefix >> shift) && prefixLength > bestPrefixLength) {
        bestPrefixLength = prefixLength
        bestUrls = urls
      }
    }
  }

  return bestUrls ? selectSecureServiceUrl(bestUrls) : null
}

export function buildRdapQueryUrl(baseUrl: string, objectType: "domain" | "ip", query: string): string {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`
  const encodedQuery = encodeURIComponent(query).replace(/%3A/gi, ":")
  return new URL(`${objectType}/${encodedQuery}`, normalizedBase).toString()
}
