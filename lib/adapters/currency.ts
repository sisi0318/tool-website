import { DollarSign } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"

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
      options: [
        { label: "USD", value: "USD" },
        { label: "EUR", value: "EUR" },
        { label: "GBP", value: "GBP" },
        { label: "JPY", value: "JPY" },
        { label: "CNY", value: "CNY" },
      ],
      hasInput: true,
      hasOutput: true,
    },
    {
      id: "to",
      name: "To",
      dataType: "string",
      defaultValue: "EUR",
      options: [
        { label: "USD", value: "USD" },
        { label: "EUR", value: "EUR" },
        { label: "GBP", value: "GBP" },
        { label: "JPY", value: "JPY" },
        { label: "CNY", value: "CNY" },
      ],
      hasInput: true,
      hasOutput: true,
    },
  ],
  outputs: [
    { id: "result", name: "Result", dataType: "json" },
  ],
  async execute(inputs, config) {
    const amount = Number(inputs.amount ?? config.amount ?? 0)
    const from = String(inputs.from ?? config.from ?? "USD")
    const to = String(inputs.to ?? config.to ?? "EUR")

    const rates: Record<string, number> = {
      USD: 1,
      EUR: 0.92,
      GBP: 0.79,
      JPY: 149.5,
      CNY: 7.24,
    }

    const usdAmount = amount / rates[from]
    const converted = usdAmount * rates[to]

    return {
      result: {
        amount,
        from,
        to,
        converted: Math.round(converted * 100) / 100,
        rate: rates[to] / rates[from],
      },
    }
  },
}

export function registerCurrencyAdapter(): void {
  registerNode(currencyAdapter)
}
