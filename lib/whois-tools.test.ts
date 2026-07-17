import { describe, expect, it } from "vitest"
import {
  buildRdapQueryUrl,
  detectRdapQueryType,
  findDomainRdapServer,
  findIpRdapServer,
  isValidIpv6Address,
  normalizeRdapQuery,
  type RdapBootstrapRegistry,
} from "./whois-tools"

describe("WHOIS/RDAP tools", () => {
  it("recognizes compressed and full IPv6 addresses", () => {
    expect(isValidIpv6Address("2001:db8::1")).toBe(true)
    expect(isValidIpv6Address("2001:db8:0:0:0:0:0:1")).toBe(true)
  })

  it("does not mistake host:port input for IPv6", () => {
    expect(detectRdapQueryType("example.com:443")).toBe("domain")
    expect(detectRdapQueryType("localhost:3000")).toBe("auto")
  })

  it("normalizes URLs, trailing dots, and bracketed IPv6 input", () => {
    expect(normalizeRdapQuery("https://WWW.Example.COM:443/path?q=1")).toBe("www.example.com")
    expect(normalizeRdapQuery("example.com.")).toBe("example.com")
    expect(normalizeRdapQuery("[2001:db8::1]")).toBe("2001:db8::1")
  })

  it("uses the label-wise longest domain bootstrap match", () => {
    const registry: RdapBootstrapRegistry = {
      services: [
        [["com"], ["https://com.example/rdap/"]],
        [["example.com"], ["https://specific.example/"]],
      ],
    }
    expect(findDomainRdapServer("a.example.com", registry)).toBe("https://specific.example/")
    expect(findDomainRdapServer("goodexample.com", registry)).toBe("https://com.example/rdap/")
  })

  it("uses the longest matching IPv4 prefix and prefers HTTPS", () => {
    const registry: RdapBootstrapRegistry = {
      services: [
        [["192.0.0.0/8"], ["http://broad.example/"]],
        [["192.0.2.0/24"], ["http://specific.example/", "https://specific.example/rdap"]],
      ],
    }
    expect(findIpRdapServer("192.0.2.42", registry)).toBe("https://specific.example/rdap/")
  })

  it("matches compressed IPv6 prefixes", () => {
    const registry: RdapBootstrapRegistry = {
      services: [
        [["2001:db8::/32"], ["https://broad.example/"]],
        [["2001:db8:abcd::/48"], ["https://specific.example/"]],
      ],
    }
    expect(findIpRdapServer("2001:db8:abcd::1234", registry)).toBe("https://specific.example/")
  })

  it("builds an encoded RDAP object URL", () => {
    expect(buildRdapQueryUrl("https://rdap.example/root", "domain", "example.com")).toBe(
      "https://rdap.example/root/domain/example.com",
    )
    expect(buildRdapQueryUrl("https://rdap.example/", "ip", "2001:db8::1")).toBe(
      "https://rdap.example/ip/2001:db8::1",
    )
  })
})
