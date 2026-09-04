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

  it("neutralizes path-traversal payloads before they reach an RDAP server", () => {
    // 未规范化时,".." 段会把请求带到注册局主机上的任意路径。
    const hostile = "..%2F..%2F..%2Fanything%3Fq%3D1%23.com"
    const normalized = normalizeRdapQuery(hostile)
    const url = buildRdapQueryUrl("https://rdap.example/root/", "domain", normalized)
    const prefix = "https://rdap.example/root/domain/"
    expect(url.startsWith(prefix)).toBe(true)
    // 关键是整段落在一个路径片段里:没有裸 "/"、"?"、"#" 可以跳出去。
    expect(url.slice(prefix.length)).not.toMatch(/[/?#]/)

    // 带 scheme/端口/路径的输入统一收敛成主机名。
    expect(normalizeRdapQuery("https://evil.test:8443/a/b?c=d#e")).toBe("evil.test")
    expect(buildRdapQueryUrl("https://rdap.example/", "domain", "a/b")).toBe(
      "https://rdap.example/domain/a%2Fb",
    )
  })
})
