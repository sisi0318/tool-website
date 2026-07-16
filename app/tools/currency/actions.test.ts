import { afterEach, describe, expect, it, vi } from "vitest"

import { getAllExchangeRates } from "./actions"

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("currency server actions", () => {
  it("uses URL-scoped Next fetch caching for public exchange-rate data", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        result: "success",
        rates: { USD: 1, CNY: 7.2 },
        time_last_update_unix: 1_700_000_000,
      }),
    })
    vi.stubGlobal("fetch", fetchMock)

    const result = await getAllExchangeRates()

    expect(fetchMock).toHaveBeenCalledWith(
      "https://open.er-api.com/v6/latest/USD",
      { next: { revalidate: 28_800 } },
    )
    expect(result.rates.CNY).toBe(7.2)
  })
})
