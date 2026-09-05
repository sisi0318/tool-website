import { toUnicode } from "punycode/"

// Query pairs are kept as an ordered list, including flags and empty entries.
// Form query rules: https://url.spec.whatwg.org/#urlencoded-parsing
export const URL_TOOL_LIMITS = { chars: 65536, parameters: 2000 } as const
export const URL_PROTOCOLS = ["https:", "http:", "wss:", "ws:", "ftp:", "file:"] as const
export interface UrlParameter { id: number; name: string; value: string; hasEquals: boolean; enabled: boolean; rawName?: string; rawValue?: string; originalName?: string; originalValue?: string }
export interface UrlParts { protocol: string; username: string; password: string; hostname: string; port: string; pathname: string; fragment: string; queryPresent: boolean; fragmentPresent: boolean; parameters: UrlParameter[] }
export interface UrlIssue { field: "name" | "value" | "pathname" | "fragment" | "username" | "password"; parameter?: number }
export interface UrlInspection { parts: UrlParts; href: string; origin: string; unicodeHostname: string; decodedPath: string; decodedFragment: string; decodedUsername: string; decodedPassword: string; issues: UrlIssue[] }
export class UrlToolError extends Error {
  constructor(public code: "inputLimit" | "parameterLimit" | "invalidUrl" | "invalidProtocol" | "invalidHost" | "invalidPort" | "invalidPath" | "invalidEncoding" | "invalidParameter") { super(code); this.name = "UrlToolError" }
}
function decodePart(text: string, plusAsSpace: boolean, issue: () => void): string {
  try { return decodeURIComponent(plusAsSpace ? text.replace(/\+/g, " ") : text) } catch { issue(); return text }
}
function bounded(input: string) { if (input.length > URL_TOOL_LIMITS.chars) throw new UrlToolError("inputLimit") }
function validUnicode(input: string) { if (Array.from(input).some((character) => { const value = character.codePointAt(0)!; return value >= 0xd800 && value <= 0xdfff })) throw new UrlToolError("invalidEncoding") }
function validateProtocol(protocol: string) { if (!URL_PROTOCOLS.includes(protocol as typeof URL_PROTOCOLS[number])) throw new UrlToolError("invalidProtocol") }

export function inspectUrl(input: string, options: { base?: string; plusAsSpace?: boolean } = {}): UrlInspection {
  bounded(input); bounded(options.base ?? "")
  validUnicode(input); validUnicode(options.base ?? "")
  if (!input.trim() || /[\x00-\x1f\x7f]/.test(input.trim())) throw new UrlToolError("invalidUrl")
  let url: URL
  try { url = new URL(input, options.base || undefined) } catch { throw new UrlToolError("invalidUrl") }
  validateProtocol(url.protocol)
  bounded(url.href)
  const hashAt = url.href.indexOf("#"), withoutHash = hashAt >= 0 ? url.href.slice(0, hashAt) : url.href, queryAt = withoutHash.indexOf("?")
  const query = queryAt >= 0 ? withoutHash.slice(queryAt + 1) : "", issues: UrlIssue[] = []
  const tokens = query ? query.split("&") : []
  if (tokens.length > URL_TOOL_LIMITS.parameters) throw new UrlToolError("parameterLimit")
  const parameters = tokens.map((token, id): UrlParameter => {
    const equals = token.indexOf("="), rawName = equals < 0 ? token : token.slice(0, equals), rawValue = equals < 0 ? "" : token.slice(equals + 1)
    const name = decodePart(rawName, options.plusAsSpace !== false, () => issues.push({ field: "name", parameter: id + 1 }))
    const value = decodePart(rawValue, options.plusAsSpace !== false, () => issues.push({ field: "value", parameter: id + 1 }))
    return { id, name, value, hasEquals: equals >= 0, enabled: true, rawName, rawValue, originalName: name, originalValue: value }
  })
  const fragment = hashAt >= 0 ? url.href.slice(hashAt + 1) : ""
  const decode = (text: string, field: UrlIssue["field"]) => decodePart(text, false, () => issues.push({ field }))
  return { href: url.href, origin: url.origin, unicodeHostname: toUnicode(url.hostname), decodedPath: decode(url.pathname, "pathname"), decodedFragment: decode(fragment, "fragment"), decodedUsername: decode(url.username, "username"), decodedPassword: decode(url.password, "password"), issues, parts: { protocol: url.protocol, username: url.username, password: url.password, hostname: url.hostname, port: url.port, pathname: url.pathname, fragment, queryPresent: queryAt >= 0, fragmentPresent: hashAt >= 0, parameters } }
}

export function buildUrl(parts: UrlParts, options: { preserveEncoding?: boolean; spaceEncoding?: "percent" | "plus" } = {}): string {
  for (const value of [parts.protocol, parts.hostname, parts.port, parts.username, parts.password, parts.pathname, parts.fragment]) { bounded(value); validUnicode(value) }
  validateProtocol(parts.protocol)
  if ((!parts.hostname && parts.protocol !== "file:") || /[\s/?#@\\]/.test(parts.hostname) || (parts.hostname.includes(":") && !/^\[[\da-f:.]+\]$/i.test(parts.hostname))) throw new UrlToolError("invalidHost")
  if (parts.port && (!/^\d+$/.test(parts.port) || Number(parts.port) > 65535)) throw new UrlToolError("invalidPort")
  if (/[?#\x00-\x1f\x7f\\]/.test(parts.pathname)) throw new UrlToolError("invalidPath")
  if (/[\x00-\x1f\x7f]/.test(parts.fragment)) throw new UrlToolError("invalidEncoding")
  if (parts.parameters.length > URL_TOOL_LIMITS.parameters) throw new UrlToolError("parameterLimit")
  if (parts.protocol === "file:" && (parts.port || parts.username || parts.password)) throw new UrlToolError("invalidUrl")
  if (options.spaceEncoding && !["percent", "plus"].includes(options.spaceEncoding)) throw new UrlToolError("invalidEncoding")
  const encode = (text: string) => {
    try { const encoded = encodeURIComponent(text).replace(/[!'()*]/g, (character) => "%" + character.charCodeAt(0).toString(16).toUpperCase()); return options.spaceEncoding === "plus" ? encoded.replace(/%20/g, "+") : encoded } catch { throw new UrlToolError("invalidEncoding") }
  }
  const pairs: string[] = []
  let size = 0
  for (const parameter of parts.parameters) {
    if (typeof parameter.name !== "string" || typeof parameter.value !== "string" || typeof parameter.hasEquals !== "boolean" || typeof parameter.enabled !== "boolean") throw new UrlToolError("invalidParameter")
    if (!parameter.enabled) continue
    if (!parameter.hasEquals && parameter.value !== "") throw new UrlToolError("invalidParameter")
    const preserve = options.preserveEncoding !== false
    const compatibleRaw = (raw: string, decoded: string) => options.spaceEncoding !== "plus" || decodePart(raw, true, () => {}) === decoded
    const name = preserve && parameter.name === parameter.originalName && parameter.rawName !== undefined && compatibleRaw(parameter.rawName, parameter.name) ? parameter.rawName : encode(parameter.name)
    const value = preserve && parameter.value === parameter.originalValue && parameter.rawValue !== undefined && compatibleRaw(parameter.rawValue, parameter.value) ? parameter.rawValue : encode(parameter.value)
    if (/[&#=]/.test(name) || /[&#]/.test(value)) throw new UrlToolError("invalidParameter")
    const pair = name + (parameter.hasEquals ? "=" + value : "")
    size += pair.length + 1; if (size > URL_TOOL_LIMITS.chars) throw new UrlToolError("inputLimit")
    pairs.push(pair)
  }
  let url: URL
  try { url = new URL(`${parts.protocol}//${parts.hostname}${parts.port ? ":" + parts.port : ""}${parts.pathname.startsWith("/") ? parts.pathname : "/" + parts.pathname}`) } catch { throw new UrlToolError("invalidUrl") }
  url.username = parts.username; url.password = parts.password
  const base = url.href, query = pairs.join("&")
  const href = base + (pairs.length || parts.queryPresent ? "?" + query : "") + (parts.fragment || parts.fragmentPresent ? "#" + parts.fragment : "")
  bounded(href)
  // Serialize fragment Unicode and unsafe literal spaces using the URL standard.
  const serialized = new URL(href).href
  bounded(serialized)
  return serialized
}

export function replaceUrlParameters(parts: UrlParts, values: unknown): UrlParts {
  if (!Array.isArray(values) || values.length > URL_TOOL_LIMITS.parameters) throw new UrlToolError("invalidParameter")
  const parameters = values.map((value: unknown, id): UrlParameter => {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new UrlToolError("invalidParameter")
    const entry = value as Record<string, unknown>
    if (typeof entry.name !== "string" || typeof entry.value !== "string" || (entry.hasEquals !== undefined && typeof entry.hasEquals !== "boolean") || (entry.enabled !== undefined && typeof entry.enabled !== "boolean")) throw new UrlToolError("invalidParameter")
    return { id, name: entry.name, value: entry.value, hasEquals: entry.hasEquals !== false, enabled: entry.enabled !== false }
  })
  return { ...parts, parameters, queryPresent: parameters.length > 0 }
}
