import { DollarSign } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"

const CURRENCIES = [
  { label: "USD", value: "USD" },
  { label: "EUR", value: "EUR" },
  { label: "GBP", value: "GBP" },
  { label: "JPY", value: "JPY" },
  { label: "CNY", value: "CNY" },
  { label: "KRW", value: "KRW" },
  { label: "AUD", value: "AUD" },
  { label: "CAD", value: "CAD" },
  { label: "CHF", value: "CHF" },
  { label: "HKD", value: "HKD" },
  { label: "SGD", value: "SGD" },
  { label: "THB", value: "THB" },
  { label: "MYR", value: "MYR" },
  { label: "IDR", value: "IDR" },
  { label: "PHP", value: "PHP" },
  { label: "VND", value: "VND" },
  { label: "INR", value: "INR" },
  { label: "RUB", value: "RUB" },
  { label: "BRL", value: "BRL" },
  { label: "MXN", value: "MXN" },
  { label: "ZAR", value: "ZAR" },
  { label: "SEK", value: "SEK" },
  { label: "NOK", value: "NOK" },
  { label: "DKK", value: "DKK" },
  { label: "PLN", value: "PLN" },
  { label: "TRY", value: "TRY" },
  { label: "NZD", value: "NZD" },
]

const CACHE_KEY = "currency-rates-cache"
const CACHE_TTL = 60 * 60 * 1000

interface CacheData {
  timestamp: number
  base: string
  rates: Record<string, number>
}

function getCachedRates(base: string): Record<string, number> | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY)
    if (!cached) return null
    const data: CacheData = JSON.parse(cached)
    if (Date.now() - data.timestamp > CACHE_TTL || data.base !== base) return null
    return data.rates
  } catch {
    return null
  }
}

function setCachedRates(base: string, rates: Record<string, number>): void {
  try {
    const data: CacheData = { timestamp: Date.now(), base, rates }
    localStorage.setItem(CACHE_KEY, JSON.stringify(data))
  } catch {
    // Ignore storage errors
  }
}

async function fetchRates(base: string): Promise<Record<string, number>> {
  const cached = getCachedRates(base)
  if (cached) return cached

  const response = await fetch(`https://open.er-api.com/v6/latest/${base}`)
  if (!response.ok) {
    throw new Error(`Failed to fetch exchange rates: ${response.status}`)
  }

  const data = await response.json()
  if (data.result !== "success") {
    throw new Error(`API error: ${data.error || "Unknown error"}`)
  }

  setCachedRates(base, data.rates)
  return data.rates
}

export const currencyAdapter: ToolAdapter = {
  type: "currency",
  category: "utility",
  label: "Currency",
  icon: DollarSign,
  config: [
    {
      id: "amount",
      name: "Amount",
      dataType: "number",
      defaultValue: 0,
      hasInput: true,
      hasOutput: false,
    },
    {
      id: "from",
      name: "From",
      dataType: "string",
      defaultValue: "USD",
      options: CURRENCIES,
      hasInput: true,
      hasOutput: true,
    },
    {
      id: "to",
      name: "To",
      dataType: "string",
      defaultValue: "EUR",
      options: CURRENCIES,
      hasInput: true,
      hasOutput: true,
    },
  ],
  outputs: [
    { id: "converted", name: "Converted", dataType: "number" },
    { id: "rate", name: "Rate", dataType: "number" },
  ],
  async execute(inputs, config) {
    const amount = Number(inputs.amount ?? config.amount ?? 0)
    const from = String(inputs.from ?? config.from ?? "USD")
    const to = String(inputs.to ?? config.to ?? "EUR")

    const rates = await fetchRates(from)
    const rate = rates[to]

    if (!rate) {
      throw new Error(`Exchange rate not found for ${to}`)
    }

    const converted = Math.round(amount * rate * 100) / 100
    return { converted, rate: Math.round(rate * 10000) / 10000 }
  },
}

export function registerCurrencyAdapter(): void {
  registerNode(currencyAdapter)
}
