import { extractDomain, extractTLD } from "@/lib/domain-extractor"
import { type NextRequest, NextResponse } from "next/server"

// Add a simple in-memory cache
const rdapBaseUrlCache = new Map<string, { url: string | null; timestamp: number }>()
const CACHE_EXPIRY = 12 * 60 * 60 * 1000 // 12 hours

// Helper function to fetch RDAP base URL with caching
async function getRdapBaseUrl(domain: string): Promise<string | null> {
  const now = Date.now()
  const cached = rdapBaseUrlCache.get(domain)

  if (cached && now - cached.timestamp < CACHE_EXPIRY) {
    console.log(`Using cached RDAP base URL for ${domain}`)
    return cached.url
  }

  try {
    // Fetch dns.js from IANA
    const response = await fetch("https://data.iana.org/rdap/dns.json", {
      cache: "force-cache",
    })
    if (!response.ok) {
      console.error(`Failed to fetch dns.js: ${response.status} ${response.statusText}`)
      return null
    }

    const text = await response.text()

    // Extract JSON from dns.js
    const jsonString = text
      .substring(text.indexOf("=") + 1)
      .trim()
      .replace(";", "")
    const data = JSON.parse(jsonString)

    const tld = extractTLD(domain)
    const tldData = data.services.find((service: any) => service[0].includes(tld))

    if (tldData && tldData[1] && tldData[1].length > 0) {
      const rdapUrl = tldData[1][0] // Return the first RDAP base URL
      rdapBaseUrlCache.set(domain, { url: rdapUrl, timestamp: now }) // Cache the URL
      return rdapUrl
    }

    rdapBaseUrlCache.set(domain, { url: null, timestamp: now }) // Cache the null result
    return null
  } catch (error) {
    console.error("Error fetching or parsing dns.js:", error)
    return null
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const domainToQuery = searchParams.get("domain")

  if (!domainToQuery) {
    return NextResponse.json({ error: "Missing domain parameter" }, { status: 400 })
  }

  try {
    const extractedDomain = extractDomain(domainToQuery)

    // Step 1: Determine the RDAP base URL
    const rdapBaseUrl = await getRdapBaseUrl(extractedDomain)

    if (!rdapBaseUrl) {
      return NextResponse.json(
        {
          error: "Could not determine RDAP server for this domain.",
          domainName: extractedDomain,
          raw: JSON.stringify({ error: "Could not determine RDAP server" }, null, 2),
        },
        { status: 404 },
      )
    }

    // Step 2: Query the RDAP server
    const rdapResponse = await fetch(`${rdapBaseUrl}/domain/${extractedDomain}`, {
      headers: {
        Accept: "application/rdap+json",
      },
    })

    if (!rdapResponse.ok) {
      console.error(`RDAP query failed: ${rdapResponse.status} ${rdapResponse.statusText}`)
      return NextResponse.json(
        {
          error: `RDAP query failed: ${rdapResponse.status} ${rdapResponse.statusText}`,
          domainName: extractedDomain,
          raw: JSON.stringify(
            { error: `RDAP query failed: ${rdapResponse.status} ${rdapResponse.statusText}` },
            null,
            2,
          ),
        },
        { status: rdapResponse.status },
      )
    }

    const rdapData = await rdapResponse.json()

    // Step 3: Return the RDAP data
    return NextResponse.json({
      domainName: extractedDomain,
      raw: JSON.stringify(rdapData, null, 2),
    })
  } catch (error: any) {
    console.error("Error during RDAP query:", error)
    return NextResponse.json(
      {
        error: error.message || "An unexpected error occurred",
        domainName: domainToQuery,
        raw: JSON.stringify({ error: error.message || "An unexpected error occurred" }, null, 2),
      },
      { status: 500 },
    )
  }
}
