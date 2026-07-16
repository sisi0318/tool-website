"use server"

interface ExchangeRateResponse {
  result: string
  rates: Record<string, number>
  time_last_update_unix: number
  error?: string
}

const CACHE_TTL_SECONDS = 8 * 60 * 60

// 从ExchangeRate-API获取汇率数据
async function fetchExchangeRates(baseCurrency = "USD"): Promise<ExchangeRateResponse> {
  const normalizedCurrency = baseCurrency.trim().toUpperCase()
  if (!/^[A-Z]{3}$/.test(normalizedCurrency)) {
    throw new Error("Invalid base currency")
  }

  try {
    // 汇率是公开、无用户态的数据。Next 按完整 URL 隔离缓存，并在 8 小时后重新验证。
    const response = await fetch(
      `https://open.er-api.com/v6/latest/${encodeURIComponent(normalizedCurrency)}`,
      { next: { revalidate: CACHE_TTL_SECONDS } },
    )

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`)
    }

    return await response.json() as ExchangeRateResponse
  } catch (error) {
    console.error("Error fetching exchange rates:", error)
    throw new Error("Failed to fetch exchange rates")
  }
}

// 获取完整的汇率表
export async function getAllExchangeRates() {
  try {
    // 使用USD作为基础货币获取所有汇率
    const data = await fetchExchangeRates("USD")

    if (data.result !== "success") {
      throw new Error(`API error: ${data.error || "Unknown error"}`)
    }

    // 返回完整的汇率数据，包括时间戳
    return {
      success: true,
      baseCurrency: "USD",
      rates: data.rates,
      lastUpdated: new Date(data.time_last_update_unix * 1000).toISOString(),
    }
  } catch (error) {
    console.error("Error fetching exchange rates:", error)
    throw new Error("Failed to fetch exchange rates")
  }
}

// 以下函数保留用于兼容性，但实际上客户端不会再调用它们
export async function convertCurrency(fromCurrency: string, toCurrency: string, amount: number) {
  try {
    const data = await fetchExchangeRates(fromCurrency)

    if (data.result !== "success") {
      throw new Error(`API error: ${data.error || "Unknown error"}`)
    }

    const normalizedTarget = toCurrency.trim().toUpperCase()
    const rate = data.rates[normalizedTarget]

    if (!rate) {
      throw new Error(`Exchange rate not found for ${normalizedTarget}`)
    }

    const convertedAmount = amount * rate

    return {
      success: true,
      fromCurrency: fromCurrency.trim().toUpperCase(),
      toCurrency: normalizedTarget,
      amount,
      convertedAmount,
      rate,
      lastUpdated: new Date(data.time_last_update_unix * 1000).toISOString(),
      allRates: data.rates,
    }
  } catch (error) {
    console.error("Currency conversion error:", error)
    throw new Error("Failed to convert currency")
  }
}

export async function getAvailableCurrencies() {
  try {
    const data = await fetchExchangeRates()

    if (data.result !== "success") {
      throw new Error(`API error: ${data.error || "Unknown error"}`)
    }

    return Object.keys(data.rates)
  } catch (error) {
    console.error("Error fetching available currencies:", error)
    throw new Error("Failed to fetch available currencies")
  }
}

export async function getMultipleRates(baseCurrency: string, targetCurrencies: string[]) {
  try {
    const data = await fetchExchangeRates(baseCurrency)

    if (data.result !== "success") {
      throw new Error(`API error: ${data.error || "Unknown error"}`)
    }

    const rates: Record<string, number> = {}

    for (const currency of targetCurrencies) {
      const normalizedCurrency = currency.trim().toUpperCase()
      if (typeof data.rates[normalizedCurrency] === "number") {
        rates[normalizedCurrency] = data.rates[normalizedCurrency]
      }
    }

    return {
      success: true,
      baseCurrency: baseCurrency.trim().toUpperCase(),
      rates,
      lastUpdated: new Date(data.time_last_update_unix * 1000).toISOString(),
    }
  } catch (error) {
    console.error("Error fetching multiple rates:", error)
    throw new Error("Failed to fetch multiple rates")
  }
}
