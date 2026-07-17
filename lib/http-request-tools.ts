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

export function buildRequestUrl(url: string, params: HttpRequestParameter[] = []): string {
  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
  } catch {
    throw new HttpRequestUrlError("INVALID_URL")
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new HttpRequestUrlError("UNSUPPORTED_PROTOCOL")
  }

  const overriddenNames = new Set(
    params
      .filter((param) => param.enabled && param.name)
      .map((param) => param.name),
  )
  overriddenNames.forEach((name) => parsedUrl.searchParams.delete(name))

  for (const param of params) {
    if (param.enabled && param.name) parsedUrl.searchParams.append(param.name, param.value || "")
  }
  return parsedUrl.toString()
}

export interface ParsedCurlCommand {
  method: string
  url: string
  headers: Array<{ name: string; value: string }>
  body: string
}

function tokenizeShellCommand(command: string): string[] {
  const tokens: string[] = []
  let current = ""
  let quote: "'" | '"' | null = null

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
    } else if (character === "\\" && (next === "\r" || next === "\n")) {
      if (next === "\r" && command[index + 2] === "\n") index += 1
      index += 1
    } else if (character === "\\" && (next === "'" || next === '"' || next === "\\" || /\s/.test(next ?? ""))) {
      current += next
      index += 1
    } else if (/\s/.test(character)) {
      if (current) {
        tokens.push(current)
        current = ""
      }
    } else {
      current += character
    }
  }

  if (quote) throw new Error("UNCLOSED_QUOTE")
  if (current) tokens.push(current)
  return tokens
}

export function parseCurlCommand(command: string): ParsedCurlCommand {
  const tokens = tokenizeShellCommand(command.trim())
  if (tokens[0]?.toLowerCase() !== "curl") throw new Error("INVALID_CURL_COMMAND")

  let method = "GET"
  let methodWasExplicit = false
  let url = ""
  const headers: Array<{ name: string; value: string }> = []
  const dataParts: string[] = []
  const optionsWithValue = new Set([
    "-A", "--user-agent", "-b", "--cookie", "-c", "--cookie-jar", "-u", "--user",
    "-x", "--proxy", "--connect-timeout", "--max-time", "--cacert", "--cert", "--key",
    "--resolve", "--interface", "-o", "--output",
  ])

  const takeValue = (index: number) => {
    const value = tokens[index + 1]
    if (value === undefined) throw new Error("MISSING_OPTION_VALUE")
    return value
  }

  const addHeader = (header: string) => {
    const separator = header.indexOf(":")
    if (separator <= 0) return
    headers.push({
      name: header.slice(0, separator).trim(),
      value: header.slice(separator + 1).trim(),
    })
  }

  for (let index = 1; index < tokens.length; index += 1) {
    const token = tokens[index]

    if (token === "-X" || token === "--request") {
      method = takeValue(index).toUpperCase()
      methodWasExplicit = true
      index += 1
    } else if (token.startsWith("--request=")) {
      method = token.slice("--request=".length).toUpperCase()
      methodWasExplicit = true
    } else if (token.startsWith("-X") && token.length > 2) {
      method = token.slice(2).toUpperCase()
      methodWasExplicit = true
    } else if (token === "-H" || token === "--header") {
      addHeader(takeValue(index))
      index += 1
    } else if (token.startsWith("--header=")) {
      addHeader(token.slice("--header=".length))
    } else if (token.startsWith("-H") && token.length > 2) {
      addHeader(token.slice(2))
    } else if (["-d", "--data", "--data-raw", "--data-binary", "--data-urlencode"].includes(token)) {
      dataParts.push(takeValue(index))
      index += 1
    } else if (/^--data(?:-raw|-binary|-urlencode)?=/.test(token)) {
      dataParts.push(token.slice(token.indexOf("=") + 1))
    } else if (token === "--url") {
      url = takeValue(index)
      index += 1
    } else if (token.startsWith("--url=")) {
      url = token.slice("--url=".length)
    } else if (token === "-I" || token === "--head") {
      method = "HEAD"
      methodWasExplicit = true
    } else if (optionsWithValue.has(token)) {
      takeValue(index)
      index += 1
    } else if (!token.startsWith("-") && !url) {
      url = token
    }
  }

  if (!url) throw new Error("MISSING_URL")
  if (dataParts.length > 0 && !methodWasExplicit) method = "POST"

  return {
    method,
    url,
    headers,
    body: dataParts.join("&"),
  }
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
