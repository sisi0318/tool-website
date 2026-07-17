export interface ExchangeRateTable {
  baseCurrency: string
  rates: Record<string, number>
  lastUpdated: string
}

export function isExchangeRateTable(value: unknown): value is ExchangeRateTable {
  if (!value || typeof value !== "object") return false
  const candidate = value as Partial<ExchangeRateTable>
  if (
    typeof candidate.baseCurrency !== "string" ||
    !/^[A-Z]{3}$/.test(candidate.baseCurrency) ||
    typeof candidate.lastUpdated !== "string" ||
    Number.isNaN(Date.parse(candidate.lastUpdated)) ||
    !candidate.rates ||
    typeof candidate.rates !== "object"
  ) {
    return false
  }

  const entries = Object.entries(candidate.rates)
  return (
    entries.length > 0 &&
    entries.every(
      ([code, rate]) =>
        /^[A-Z]{3}$/.test(code) &&
        typeof rate === "number" &&
        Number.isFinite(rate) &&
        rate > 0,
    )
  )
}

export function getExchangeRate(
  table: ExchangeRateTable,
  fromCurrency: string,
  toCurrency: string,
): number | null {
  const fromRate =
    fromCurrency === table.baseCurrency ? 1 : table.rates[fromCurrency]
  const toRate =
    toCurrency === table.baseCurrency ? 1 : table.rates[toCurrency]

  if (
    typeof fromRate !== "number" ||
    typeof toRate !== "number" ||
    !Number.isFinite(fromRate) ||
    !Number.isFinite(toRate) ||
    fromRate <= 0 ||
    toRate <= 0
  ) {
    return null
  }

  return toRate / fromRate
}

export function convertCurrencyAmount(
  table: ExchangeRateTable,
  amount: number,
  fromCurrency: string,
  toCurrency: string,
): number | null {
  if (!Number.isFinite(amount) || amount < 0) return null
  const rate = getExchangeRate(table, fromCurrency, toCurrency)
  return rate === null ? null : amount * rate
}

export function parseCurrencyAmount(value: string): number | null {
  const normalized = value.trim().replace(/\s|_/g, "")
  if (!normalized || !/^\d+(?:\.\d*)?$|^\.\d+$/.test(normalized)) return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

export function buildCurrencyValues(
  table: ExchangeRateTable,
  amount: number,
  baseCurrency: string,
  currencies: readonly string[],
  fractionDigits = 2,
): Record<string, string> {
  const values: Record<string, string> = {
    [baseCurrency]: amount.toString(),
  }

  for (const currency of currencies) {
    if (currency === baseCurrency) continue
    const converted = convertCurrencyAmount(table, amount, baseCurrency, currency)
    if (converted !== null) values[currency] = converted.toFixed(fractionDigits)
  }

  return values
}
