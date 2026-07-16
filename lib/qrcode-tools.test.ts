import { describe, expect, it } from "vitest"
import { buildPaymentQrValue } from "./qrcode-tools"

describe("QR code tools", () => {
  it("includes the selected currency and all payment fields", () => {
    expect(
      buildPaymentQrValue({
        recipient: "Alice & Bob",
        amount: "12.50",
        currency: "CNY",
        message: "午餐",
      }),
    ).toBe("payment:?currency=CNY&amount=12.50&recipient=Alice+%26+Bob&message=%E5%8D%88%E9%A4%90")
  })
})
