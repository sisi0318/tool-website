import { describe, expect, it } from "vitest"

import {
  buildCurrencyValues,
  convertCurrencyAmount,
  getExchangeRate,
  isExchangeRateTable,
  parseCurrencyAmount,
  type ExchangeRateTable,
} from "./currency-tools"

const table: ExchangeRateTable = {
  baseCurrency: "USD",
  rates: {
    EUR: 0.8,
    JPY: 160,
    CNY: 7.2,
  },
  lastUpdated: "2026-07-17T00:00:00.000Z",
}

describe("currency tools", () => {
  it("calculates direct, inverse, and cross rates from one table", () => {
    expect(getExchangeRate(table, "USD", "EUR")).toBe(0.8)
    expect(getExchangeRate(table, "EUR", "USD")).toBe(1.25)
    expect(getExchangeRate(table, "EUR", "JPY")).toBe(200)
  })

  it("rejects missing currencies and invalid amounts", () => {
    expect(getExchangeRate(table, "USD", "ABC")).toBeNull()
    expect(convertCurrencyAmount(table, -1, "USD", "EUR")).toBeNull()
    expect(parseCurrencyAmount("Infinity")).toBeNull()
    expect(parseCurrencyAmount("1.2.3")).toBeNull()
  })

  it("builds synchronized multi-currency values", () => {
    expect(buildCurrencyValues(table, 10, "EUR", ["EUR", "USD", "JPY"])).toEqual({
      EUR: "10",
      USD: "12.50",
      JPY: "2000.00",
    })
  })

  it("validates cached rate tables before use", () => {
    expect(isExchangeRateTable(table)).toBe(true)
    expect(isExchangeRateTable({ ...table, rates: { EUR: Number.NaN } })).toBe(false)
    expect(isExchangeRateTable({ ...table, lastUpdated: "not-a-date" })).toBe(false)
  })
})
