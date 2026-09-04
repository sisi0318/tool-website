import {
  buildRdapQueryUrl,
  detectRdapQueryType,
  findDomainRdapServer,
  findIpRdapServer,
  normalizeRdapQuery,
  type RdapBootstrapRegistry,
} from "@/lib/whois-tools"
import { type NextRequest, NextResponse } from "next/server"

// 标记为动态路由
export const dynamic = "force-dynamic"

const BOOTSTRAP_URLS = {
  domain: "https://data.iana.org/rdap/dns.json",
  ipv4: "https://data.iana.org/rdap/ipv4.json",
  ipv6: "https://data.iana.org/rdap/ipv6.json",
} as const

/** IANA 引导文件一天刷新一次:force-cache 会让新 TLD / 迁移后的服务器永远拿不到。 */
const BOOTSTRAP_TTL_SECONDS = 24 * 60 * 60
const UPSTREAM_TIMEOUT_MS = 8000
/** RDAP 服务器域名白名单:只允许引导文件里出现过的主机,防止被构造出的地址带走。 */
const ALLOWED_HOST_PATTERN = /^[a-z0-9.-]+$/i

async function fetchBootstrap(kind: keyof typeof BOOTSTRAP_URLS): Promise<RdapBootstrapRegistry | null> {
  try {
    const response = await fetch(BOOTSTRAP_URLS[kind], {
      next: { revalidate: BOOTSTRAP_TTL_SECONDS },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    })
    if (!response.ok) return null
    // 引导文件是标准 JSON,直接解析;旧代码按 JS 片段截断,遇到含 "=" 的 URL 会整体失败。
    const data: unknown = await response.json()
    if (data === null || typeof data !== "object" || !Array.isArray((data as RdapBootstrapRegistry).services)) {
      return null
    }
    return data as RdapBootstrapRegistry
  } catch {
    return null
  }
}

function errorResponse(message: string, query: string, status: number) {
  return NextResponse.json(
    { error: message, domainName: query, raw: JSON.stringify({ error: message }, null, 2) },
    { status },
  )
}

export async function GET(request: NextRequest) {
  const rawQuery = request.nextUrl.searchParams.get("domain")

  if (!rawQuery) {
    return NextResponse.json({ error: "Missing domain parameter" }, { status: 400 })
  }

  // 规范化后才可信:剥掉 scheme/端口/路径,统一小写,拒绝任何非主机字符。
  const query = normalizeRdapQuery(rawQuery)
  const queryType = detectRdapQueryType(query)

  if (!query || queryType === "auto" || !ALLOWED_HOST_PATTERN.test(query.replace(/:/g, ""))) {
    return errorResponse("Invalid domain or IP address", rawQuery, 400)
  }

  const isIp = queryType === "ipv4" || queryType === "ipv6"
  const registry = await fetchBootstrap(isIp ? queryType : "domain")

  if (!registry) {
    return errorResponse("Could not load the RDAP bootstrap registry.", query, 502)
  }

  const rdapBaseUrl = isIp
    ? findIpRdapServer(query, registry)
    : findDomainRdapServer(query, registry)

  if (!rdapBaseUrl) {
    return errorResponse("Could not determine RDAP server for this query.", query, 404)
  }

  const queryUrl = buildRdapQueryUrl(rdapBaseUrl, isIp ? "ip" : "domain", query)

  try {
    const rdapResponse = await fetch(queryUrl, {
      headers: { Accept: "application/rdap+json" },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    })

    if (!rdapResponse.ok) {
      return errorResponse(`RDAP query failed (${rdapResponse.status})`, query, rdapResponse.status)
    }

    const rdapData = await rdapResponse.json()

    return NextResponse.json(
      { domainName: query, raw: JSON.stringify(rdapData, null, 2) },
      // 公开数据,让 CDN 吸收重复查询。
      { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
    )
  } catch (error) {
    // 不回显上游异常文本,避免泄露内部网络细节。
    console.error("RDAP query failed:", error)
    return errorResponse("RDAP query failed", query, 502)
  }
}
