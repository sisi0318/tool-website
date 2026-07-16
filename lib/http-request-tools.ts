export interface HttpRequestParameter {
  name: string
  value: string
  enabled: boolean
}

export function buildRequestUrl(url: string, params: HttpRequestParameter[] = []): string {
  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
  } catch {
    throw new Error("请输入包含 http:// 或 https:// 的有效完整 URL")
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new Error("仅支持 HTTP 和 HTTPS URL")
  }

  for (const param of params) {
    if (param.enabled && param.name) parsedUrl.searchParams.append(param.name, param.value || "")
  }
  return parsedUrl.toString()
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
