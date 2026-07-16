export type RdapQueryType = "domain" | "ipv4" | "ipv6" | "auto"

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
  const normalized = query.trim()
  if (IPV4_PATTERN.test(normalized)) return "ipv4"
  if (isValidIpv6Address(normalized)) return "ipv6"
  if (normalized.includes(".") && !/\s/.test(normalized)) return "domain"
  return "auto"
}
