import { describe, expect, it } from "vitest"

import { csvCell, parseQRContent } from "./qr-content-tools"

describe("QR content parsing", () => {
  it("parses Wi-Fi fields regardless of order and preserves escaped delimiters", () => {
    expect(parseQRContent("WIFI:S:Cafe\\;Guest;H:true;P:p\\:ass;T:WPA2;;")).toEqual({
      type: "wifi",
      details: {
        type: "WPA2",
        ssid: "Cafe;Guest",
        password: "p:ass",
        hidden: true,
      },
    })
  })

  it("extracts the address from a mailto URI without its query", () => {
    expect(parseQRContent("mailto:hello%2Bqr@example.com?subject=Hi")).toEqual({
      type: "email",
      details: { email: "hello+qr@example.com" },
    })
  })

  it("normalizes common vCard property parameters", () => {
    expect(
      parseQRContent("BEGIN:VCARD\nFN:Ada Lovelace\nTEL;TYPE=CELL:+123\nEMAIL:a@example.com\nEND:VCARD"),
    ).toMatchObject({
      type: "vcard",
      details: { fn: "Ada Lovelace", tel: "+123", email: "a@example.com" },
    })
  })

  it("supports JSON arrays and falls back to text for malformed JSON", () => {
    expect(parseQRContent("[1,2]")).toEqual({ type: "json", details: { value: [1, 2] } })
    expect(parseQRContent("{broken}").type).toBe("text")
  })

  it("neutralizes spreadsheet formulas in CSV cells", () => {
    expect(csvCell("=1+1")).toBe("\"'=1+1\"")
    expect(csvCell('a"b')).toBe('"a""b"')
  })
})
