import { describe, expect, it } from "vitest"
import { detectRdapQueryType, isValidIpv6Address } from "./whois-tools"

describe("WHOIS/RDAP tools", () => {
  it("recognizes compressed and full IPv6 addresses", () => {
    expect(isValidIpv6Address("2001:db8::1")).toBe(true)
    expect(isValidIpv6Address("2001:db8:0:0:0:0:0:1")).toBe(true)
  })

  it("does not mistake host:port input for IPv6", () => {
    expect(detectRdapQueryType("example.com:443")).toBe("domain")
    expect(detectRdapQueryType("localhost:3000")).toBe("auto")
  })
})
