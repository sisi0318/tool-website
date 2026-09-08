export interface HttpRequestParameter {
  name: string
  value: string
  enabled: boolean
}

export class HttpRequestUrlError extends Error {
  constructor(public readonly code: "INVALID_URL" | "UNSUPPORTED_PROTOCOL") {
    super(code)
    this.name = "HttpRequestUrlError"
  }
}

export function buildRequestUrl(url: string, params: HttpRequestParameter[] = [], options: { transform?: (value: string) => string; replaceQuery?: boolean } = {}): string {
  const transform = options.transform ?? ((value: string) => value)
  let parsedUrl: URL
  try {
    // Resolve the endpoint separately: a query variable containing & or = is
    // one value, never another URL parameter.
    const suffix = url.search(/[?#]/)
    parsedUrl = new URL(suffix < 0 ? transform(url) : transform(url.slice(0, suffix)) + url.slice(suffix))
  } catch {
    throw new HttpRequestUrlError("INVALID_URL")
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new HttpRequestUrlError("UNSUPPORTED_PROTOCOL")
  }

  if (options.replaceQuery) parsedUrl.search = ""
  else if (options.transform) {
    const entries = [...parsedUrl.searchParams].map(([name, value]) => [transform(name), transform(value)] as const)
    parsedUrl.search = ""
    for (const [name, value] of entries) parsedUrl.searchParams.append(name, value)
  }
  const overriddenNames = new Set(
    params
      .filter((param) => param.name)
      .flatMap((param) => [param.name, transform(param.name)]),
  )
  overriddenNames.forEach((name) => parsedUrl.searchParams.delete(name))

  for (const param of params) {
    if (param.enabled && param.name) parsedUrl.searchParams.append(transform(param.name), transform(param.value || ""))
  }
  return parsedUrl.toString()
}

export function validateHttpMethod(value: string): string {
  const method = value.toUpperCase()
  if (!["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"].includes(method)) throw new Error("UNSUPPORTED_HTTP_METHOD")
  return method
}

export function quoteShellArgument(value: string): string {
  if (value.includes("\0")) throw new Error("INVALID_SHELL_ARGUMENT")
  return `'${value.replaceAll("'", `'"'"'`)}'`
}

export function curlRequestStart(method: string, url: string): string {
  return `curl -X ${quoteShellArgument(validateHttpMethod(method))} ${quoteShellArgument(url)}`
}

export function curlTextBody(value: string): string { return `--data-raw ${quoteShellArgument(value)}` }
export function curlTextField(name: string, value: string): string { return `--form-string ${quoteShellArgument(`${name}=${value}`)}` }

export interface ParsedCurlCommand {
  method: string
  url: string
  headers: Array<{ name: string; value: string }>
  body: string
  bodyType: "none" | "raw" | "form-data"
  formData?: Array<{ name: string; value: string }>
}

function tokenizeShellCommand(command: string): string[] {
  const tokens: string[] = []
  let current = ""
  let quote: "'" | '"' | null = null
  let started = false

  for (let index = 0; index < command.length; index += 1) {
    const character = command[index]
    const next = command[index + 1]

    if (quote) {
      if (character === quote) {
        quote = null
      } else if (character === "\\" && quote === '"' && (next === '"' || next === "\\")) {
        current += next
        index += 1
      } else {
        current += character
      }
      continue
    }

    if (character === "'" || character === '"') {
      quote = character
      started = true
    } else if (character === "\\" && (next === "\r" || next === "\n")) {
      if (next === "\r" && command[index + 2] === "\n") index += 1
      index += 1
    } else if (character === "\\" && (next === "'" || next === '"' || next === "\\" || /\s/.test(next ?? ""))) {
      current += next
      started = true
      index += 1
    } else if (/\s/.test(character)) {
      if (started) {
        tokens.push(current)
        current = ""
        started = false
      }
    } else {
      current += character
      started = true
    }
  }

  if (quote) throw new Error("UNCLOSED_QUOTE")
  if (started) tokens.push(current)
  return tokens
}

export function parseCurlCommand(command: string): ParsedCurlCommand {
  const tokens = tokenizeShellCommand(command.trim())
  if (tokens[0]?.toLowerCase() !== "curl") throw new Error("INVALID_CURL_COMMAND")
  let method = "GET", methodWasExplicit = false, url = ""
  const headers: Array<{ name: string; value: string }> = [], dataParts: string[] = [], formData: Array<{ name: string; value: string }> = []
  const addHeader = (header: string) => {
    const separator = header.indexOf(":")
    if (separator <= 0 || /[\r\n]/.test(header)) throw new Error("INVALID_CURL_HEADER")
    headers.push({ name: header.slice(0, separator).trim(), value: header.slice(separator + 1).trim() })
  }
  const encode = (value: string) => encodeURIComponent(value).replace(/[!'()*]/g, character => "%" + character.charCodeAt(0).toString(16).toUpperCase()).replace(/%20/g, "+")
  for (let index = 1; index < tokens.length; index++) {
    let option = tokens[index], inline: string | undefined
    if (option.startsWith("--") && option.includes("=")) { const at = option.indexOf("="); inline = option.slice(at + 1); option = option.slice(0, at) }
    else if (/^-[XHdbAFu].+/.test(option)) { inline = option.slice(2); option = option.slice(0, 2) }
    const value = () => {
      if (inline !== undefined) return inline
      if (++index >= tokens.length) throw new Error("MISSING_OPTION_VALUE")
      return tokens[index]
    }
    if (["-X", "--request"].includes(option)) { method = validateHttpMethod(value()); methodWasExplicit = true }
    else if (["-H", "--header"].includes(option)) addHeader(value())
    else if (["-d", "--data", "--data-raw", "--data-binary", "--data-urlencode"].includes(option)) {
      const text = value()
      if (option === "--data-urlencode") {
        const equals = text.indexOf("="), at = text.indexOf("@")
        if (at >= 0 && (equals < 0 || at < equals)) throw new Error("UNSUPPORTED_CURL_FILE_INPUT")
        dataParts.push(equals < 0 ? encode(text) : equals === 0 ? encode(text.slice(1)) : text.slice(0, equals + 1) + encode(text.slice(equals + 1)))
      } else {
        if (option !== "--data-raw" && text.startsWith("@")) throw new Error("UNSUPPORTED_CURL_FILE_INPUT")
        dataParts.push(text)
      }
    } else if (["-F", "--form", "--form-string"].includes(option)) {
      const text = value(), at = text.indexOf("=")
      if (at <= 0) throw new Error("INVALID_CURL_FORM")
      const field = text.slice(at + 1)
      // File selectors and curl multipart directives need a real File selection.
      if (option !== "--form-string" && (/^[@<]/.test(field) || field.includes(";"))) throw new Error("UNSUPPORTED_CURL_FILE_INPUT")
      formData.push({ name: text.slice(0, at), value: field })
    } else if (["-b", "--cookie"].includes(option)) {
      const cookie = value()
      if (!cookie.includes("=")) throw new Error("UNSUPPORTED_CURL_FILE_INPUT")
      addHeader(`Cookie: ${cookie}`)
    } else if (["-A", "--user-agent"].includes(option)) addHeader(`User-Agent: ${value()}`)
    else if (option === "--url") { if (url) throw new Error("MULTIPLE_CURL_URLS"); url = value() }
    else if (["-I", "--head"].includes(option)) { method = "HEAD"; methodWasExplicit = true }
    else if (["-s", "--silent", "-S", "--show-error", "-v", "--verbose", "--compressed", "-L", "--location"].includes(option) && inline === undefined) { /* Presentation / supported proxy transport options. */ }
    else if (option.startsWith("-")) throw new Error(`UNSUPPORTED_CURL_OPTION: ${option}`)
    else { if (url) throw new Error("MULTIPLE_CURL_URLS"); url = option }
  }
  if (!url) throw new Error("MISSING_URL")
  if (dataParts.length && formData.length) throw new Error("CONFLICTING_CURL_BODY")
  if ((dataParts.length || formData.length) && !methodWasExplicit) method = "POST"
  if (dataParts.length && !headers.some(header => header.name.toLowerCase() === "content-type")) addHeader("Content-Type: application/x-www-form-urlencoded")
  return { method: validateHttpMethod(method), url, headers, body: dataParts.join("&"), bodyType: formData.length ? "form-data" : dataParts.length ? "raw" : "none", ...(formData.length ? { formData } : {}) }
}

export function encodeUrlEncodedBody(
  params: HttpRequestParameter[],
  transform: (value: string) => string = (value) => value,
): string {
  const body = new URLSearchParams()
  for (const param of params) {
    if (param.enabled && param.name) {
      body.append(transform(param.name), transform(param.value || ""))
    }
  }
  return body.toString()
}
