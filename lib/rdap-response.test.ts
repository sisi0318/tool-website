import { describe, expect, it } from "vitest"

import { parseRdapResponse } from "./rdap-response"

describe("RDAP response parsing", () => {
  it("extracts domain events, registrar, address fields, and DNSSEC", () => {
    const result = parseRdapResponse({
      ldhName: "EXAMPLE.COM",
      events: [
        { eventAction: "registration", eventDate: "2000-01-01T00:00:00Z" },
        { eventAction: "expiration", eventDate: "2030-01-01T00:00:00Z" },
      ],
      entities: [
        {
          roles: ["registrar"],
          vcardArray: ["vcard", [["fn", {}, "text", "Example Registrar"]]],
        },
        {
          roles: ["registrant"],
          vcardArray: [
            "vcard",
            [
              ["fn", {}, "text", "Ada"],
              ["adr", {}, "text", ["", "", "Main St", "London", "", "N1", "GB"]],
            ],
          ],
        },
      ],
      nameservers: [{ ldhName: "NS1.EXAMPLE.COM" }],
      secureDNS: { delegationSigned: true },
    }, {
      queryTarget: "example.com",
      queryType: "domain",
      rdapServer: "https://rdap.example/",
      queryTime: 42,
    })

    expect(result).toMatchObject({
      domainName: "EXAMPLE.COM",
      registrar: "Example Registrar",
      creationDate: "2000-01-01T00:00:00Z",
      expiryDate: "2030-01-01T00:00:00Z",
      registrant: { name: "Ada", address: "Main St", city: "London", postalCode: "N1", country: "GB" },
      nameServers: ["NS1.EXAMPLE.COM"],
      dnssec: "signed",
    })
  })

  it("extracts IP network ranges without assuming domain fields", () => {
    expect(parseRdapResponse({
      name: "NET-192-0-2-0-1",
      startAddress: "192.0.2.0",
      endAddress: "192.0.2.255",
      ipVersion: "v4",
      country: "ZZ",
    }, {
      queryTarget: "192.0.2.1",
      queryType: "ipv4",
      rdapServer: "https://rdap.example/",
      queryTime: 12,
    })).toMatchObject({
      queryType: "ip",
      ipVersion: "v4",
      networkInfo: {
        startAddress: "192.0.2.0",
        endAddress: "192.0.2.255",
        country: "ZZ",
      },
    })
  })

  it("rejects non-object responses", () => {
    expect(() => parseRdapResponse([], {
      queryTarget: "example.com",
      queryType: "domain",
      rdapServer: "https://rdap.example/",
      queryTime: 1,
    })).toThrow("Invalid RDAP response")
  })
})
