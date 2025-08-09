import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const domain = searchParams.get("domain")

  if (!domain) {
    return NextResponse.json({ error: "Domain parameter is required" }, { status: 400 })
  }

  try {
    // Try using RDAP API (modern replacement for WHOIS)
    const response = await fetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`)

    if (!response.ok) {
      throw new Error(`RDAP API returned ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()

    // Extract name servers
    const nameServers = data.nameservers?.map((ns: any) => ns.ldhName) || []

    // Extract events (creation, expiration, etc.)
    const events = data.events || []
    const creationDate = events.find((e: any) => e.eventAction === "registration")?.eventDate
    const expiryDate = events.find((e: any) => e.eventAction === "expiration")?.eventDate
    const updatedDate = events.find((e: any) => e.eventAction === "last changed")?.eventDate

    // Extract status
    const status = data.status || []

    // Extract registrar info
    const registrar = data.entities?.find((e: any) => e.roles?.includes("registrar"))
    const registrarName = registrar?.vcardArray?.[1]?.find((v: any) => v[0] === "fn")?.[3]

    // Extract registrant info
    const registrant = data.entities?.find((e: any) => e.roles?.includes("registrant"))
    const registrantInfo = extractVCardInfo(registrant?.vcardArray)

    const whoisData = {
      domainName: data.ldhName || domain,
      registrar: registrarName,
      registrarUrl: registrar?.url,
      creationDate,
      expiryDate,
      updatedDate,
      registrant: {
        name: registrantInfo.name,
        organization: registrantInfo.org,
        email: registrantInfo.email,
        phone: registrantInfo.phone,
        address: registrantInfo.address,
        city: registrantInfo.city,
        state: registrantInfo.state,
        country: registrantInfo.country,
        postalCode: registrantInfo.postalCode,
      },
      nameServers,
      status,
      dnssec: data.secureDNS?.delegationSigned ? "signed" : "unsigned",
      raw: JSON.stringify(data, null, 2),
    }

    return NextResponse.json(whoisData)
  } catch (error) {
    console.error("RDAP lookup error:", error)

    // Fallback to a third option: whoisjs.com API
    try {
      const fallbackResponse = await fetch(`https://whoisjs.com/api/v1/${encodeURIComponent(domain)}`)

      if (!fallbackResponse.ok) {
        throw new Error(`Fallback WHOIS API returned ${fallbackResponse.status}`)
      }

      const fallbackData = await fallbackResponse.json()

      // Process fallback data
      const whoisData = {
        domainName: fallbackData.domain || domain,
        registrar: fallbackData.registrar?.name,
        registrarUrl: fallbackData.registrar?.url,
        creationDate: fallbackData.created,
        expiryDate: fallbackData.expires,
        updatedDate: fallbackData.changed,
        registrant: {
          name: fallbackData.registrant?.name,
          organization: fallbackData.registrant?.organization,
          email: fallbackData.registrant?.email,
          phone: fallbackData.registrant?.phone,
          address: fallbackData.registrant?.address,
          city: fallbackData.registrant?.city,
          state: fallbackData.registrant?.state,
          country: fallbackData.registrant?.country,
          postalCode: fallbackData.registrant?.postalCode,
        },
        nameServers: fallbackData.nameServers || [],
        status: fallbackData.status || [],
        dnssec: fallbackData.dnssec,
        raw: JSON.stringify(fallbackData, null, 2),
      }

      return NextResponse.json(whoisData)
    } catch (fallbackError) {
      console.error("Fallback WHOIS lookup error:", fallbackError)
      return NextResponse.json(
        {
          error: "Failed to retrieve WHOIS information. Please try again later.",
        },
        { status: 500 },
      )
    }
  }
}

// Helper function to extract vCard information
function extractVCardInfo(vcardArray: any) {
  if (!vcardArray || !Array.isArray(vcardArray) || vcardArray.length < 2) {
    return {
      name: null,
      org: null,
      email: null,
      phone: null,
      address: null,
      city: null,
      state: null,
      country: null,
      postalCode: null,
    }
  }

  const vcard = vcardArray[1]

  const getValue = (property: string) => {
    const item = vcard.find((v: any) => v[0] === property)
    return item ? item[3] : null
  }

  const getAddressPart = (property: string) => {
    const adr = vcard.find((v: any) => v[0] === "adr")
    if (!adr || !adr[3] || !Array.isArray(adr[3])) return null

    const addressParts = {
      street: 2,
      city: 3,
      state: 4,
      postalCode: 5,
      country: 6,
    }

    return adr[3][addressParts[property as keyof typeof addressParts]] || null
  }

  return {
    name: getValue("fn"),
    org: getValue("org"),
    email: getValue("email"),
    phone: getValue("tel"),
    address: getAddressPart("street"),
    city: getAddressPart("city"),
    state: getAddressPart("state"),
    country: getAddressPart("country"),
    postalCode: getAddressPart("postalCode"),
  }
}
