export interface RdapRegistrant {
  name?: string
  organization?: string
  email?: string
  phone?: string
  address?: string
  city?: string
  state?: string
  country?: string
  postalCode?: string
}

export interface RdapNetworkInfo {
  name?: string
  handle?: string
  startAddress?: string
  endAddress?: string
  ipVersion?: string
  type?: string
  country?: string
  parentHandle?: string
}

export interface ParsedRdapData {
  domainName?: string
  registrar?: string
  registrarUrl?: string
  creationDate?: string
  expiryDate?: string
  updatedDate?: string
  registrant?: RdapRegistrant
  nameServers?: string[]
  status?: string[]
  dnssec?: "signed" | "unsigned"
  rdapServer: string
  queryType: "domain" | "ip"
  ipVersion?: "v4" | "v6"
  raw: string
  queryTime: number
  networkInfo?: RdapNetworkInfo
}

type UnknownRecord = Record<string, unknown>

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const stringValue = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value : undefined

const recordArray = (value: unknown): UnknownRecord[] =>
  Array.isArray(value) ? value.filter(isRecord) : []

const stringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : []

function parseJCard(vcardArray: unknown): Record<string, string> {
  if (!Array.isArray(vcardArray) || !Array.isArray(vcardArray[1])) return {}
  const result: Record<string, string> = {}

  for (const field of vcardArray[1]) {
    if (!Array.isArray(field) || field.length < 4) continue
    const key = typeof field[0] === "string" ? field[0].toLowerCase() : ""
    const value = field[3]
    if (!key || result[key]) continue

    if (typeof value === "string" && value.trim()) {
      result[key] = value
    } else if (key === "adr" && Array.isArray(value)) {
      const parts = value.filter((part): part is string => typeof part === "string" && Boolean(part.trim()))
      if (parts.length > 0) result[key] = parts.join(", ")
      const [, , street, locality, region, postalCode, country] = value
      if (typeof street === "string" && street) result.street = street
      if (typeof locality === "string" && locality) result.locality = locality
      if (typeof region === "string" && region) result.region = region
      if (typeof postalCode === "string" && postalCode) result["postal-code"] = postalCode
      if (typeof country === "string" && country) result.country = country
    }
  }

  return result
}

function findEntityByRole(entities: unknown, role: string): UnknownRecord | undefined {
  for (const entity of recordArray(entities)) {
    if (stringArray(entity.roles).includes(role)) return entity
    const nested = findEntityByRole(entity.entities, role)
    if (nested) return nested
  }
  return undefined
}

function findEventDate(events: unknown, actions: string[]): string | undefined {
  for (const event of recordArray(events)) {
    if (actions.includes(stringValue(event.eventAction) ?? "")) {
      return stringValue(event.eventDate)
    }
  }
  return undefined
}

function findEntityUrl(entity: UnknownRecord | undefined): string | undefined {
  if (!entity) return undefined
  const cardUrl = parseJCard(entity.vcardArray).url
  if (cardUrl) return cardUrl
  for (const link of recordArray(entity.links)) {
    const href = stringValue(link.href)
    if (href?.startsWith("https://")) return href
  }
  return undefined
}

function compactRegistrant(value: RdapRegistrant): RdapRegistrant | undefined {
  return Object.values(value).some(Boolean) ? value : undefined
}

export function parseRdapResponse(
  value: unknown,
  context: {
    queryTarget: string
    queryType: "domain" | "ipv4" | "ipv6"
    rdapServer: string
    queryTime: number
  },
): ParsedRdapData {
  if (!isRecord(value)) throw new Error("Invalid RDAP response")
  const raw = JSON.stringify(value, null, 2)
  const status = stringArray(value.status)

  if (context.queryType === "domain") {
    const registrarEntity = findEntityByRole(value.entities, "registrar")
    const registrarCard = parseJCard(registrarEntity?.vcardArray)
    const registrantEntity = findEntityByRole(value.entities, "registrant")
    const registrantCard = parseJCard(registrantEntity?.vcardArray)
    const nameservers = recordArray(value.nameservers)
      .map((nameserver) => stringValue(nameserver.ldhName) ?? stringValue(nameserver.unicodeName))
      .filter((name): name is string => Boolean(name))
    const secureDns = isRecord(value.secureDNS) ? value.secureDNS : undefined

    return {
      domainName: stringValue(value.unicodeName) ?? stringValue(value.ldhName) ?? context.queryTarget,
      registrar:
        registrarCard.org ??
        registrarCard.fn ??
        (recordArray(registrarEntity?.publicIds)[0]
          ? stringValue(recordArray(registrarEntity?.publicIds)[0].identifier)
          : undefined),
      registrarUrl: findEntityUrl(registrarEntity),
      creationDate: findEventDate(value.events, ["registration"]),
      expiryDate: findEventDate(value.events, ["expiration"]),
      updatedDate: findEventDate(value.events, ["last changed", "last update of RDAP database"]),
      registrant: compactRegistrant({
        name: registrantCard.fn,
        organization: registrantCard.org,
        email: registrantCard.email,
        phone: registrantCard.tel,
        address: registrantCard.street ?? registrantCard.adr,
        city: registrantCard.locality,
        state: registrantCard.region,
        country: registrantCard.country,
        postalCode: registrantCard["postal-code"],
      }),
      nameServers: nameservers,
      status,
      dnssec: typeof secureDns?.delegationSigned === "boolean"
        ? secureDns.delegationSigned ? "signed" : "unsigned"
        : undefined,
      rdapServer: context.rdapServer,
      queryType: "domain",
      raw,
      queryTime: context.queryTime,
    }
  }

  return {
    domainName: stringValue(value.name) ?? stringValue(value.handle) ?? context.queryTarget,
    queryType: "ip",
    ipVersion: context.queryType === "ipv4" ? "v4" : "v6",
    rdapServer: context.rdapServer,
    queryTime: context.queryTime,
    networkInfo: {
      name: stringValue(value.name),
      handle: stringValue(value.handle),
      startAddress: stringValue(value.startAddress),
      endAddress: stringValue(value.endAddress),
      ipVersion: stringValue(value.ipVersion),
      type: stringValue(value.type),
      country: stringValue(value.country),
      parentHandle: stringValue(value.parentHandle),
    },
    status,
    raw,
  }
}
