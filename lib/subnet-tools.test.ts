import { describe, expect, it } from "vitest"
import { calculateSubnet } from "./subnet-tools"

describe("IP/CIDR subnet calculator", () => {
  it("calculates an IPv4 subnet and membership", () => {
    expect(calculateSubnet("192.168.10.42/24", "192.168.10.200")).toMatchObject({
      family: "IPv4", network: "192.168.10.0/24", netmask: "255.255.255.0",
      wildcard: "0.0.0.255", broadcast: "192.168.10.255", firstAddress: "192.168.10.1",
      lastAddress: "192.168.10.254", totalAddresses: "256", contains: true,
    })
  })

  it("handles IPv4 point-to-point ranges", () => {
    expect(calculateSubnet("10.0.0.4/31")).toMatchObject({ firstAddress: "10.0.0.4", lastAddress: "10.0.0.5", totalAddresses: "2" })
  })

  it("expands and compresses IPv6 values", () => {
    expect(calculateSubnet("2001:db8::1234/64", "2001:db8::beef")).toMatchObject({
      family: "IPv6", network: "2001:db8::/64", firstAddress: "2001:db8::",
      lastAddress: "2001:db8::ffff:ffff:ffff:ffff", totalAddresses: "18446744073709551616", contains: true,
    })
  })

  it("rejects invalid prefixes", () => {
    expect(() => calculateSubnet("192.0.2.1/33")).toThrow(/between 0 and 32/)
  })
})
