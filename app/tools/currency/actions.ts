"use server"

// 缓存对象，用于存储汇率数据，减少API调用
interface CacheItem {
  timestamp: number
  data: any
}

// 简单的内存缓存，在生产环境中应使用Redis等
const cache: Record<string, CacheItem> = {}
const CACHE_TTL = 8 * 60 * 60 * 1000 // 8小时缓存

// 从ExchangeRate-API获取汇率数据
async function fetchExchangeRates(baseCurrency = "USD"): Promise<any> {
  // 检查缓存
  const cacheKey = `rates_${baseCurrency}`
  const now = Date.now()

  if (cache[cacheKey] && now - cache[cacheKey].timestamp < CACHE_TTL) {
    return cache[cacheKey].data
  }

  try {
    // 使用ExchangeRate-API的免费端点
    // 注意：在生产环境中，您应该注册并使用您自己的API密钥
    const response = await fetch(`https://open.er-api.com/v6/latest/${baseCurrency}`)

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`)
    }

    const data = await response.json()

    // 存入缓存
    cache[cacheKey] = {
      timestamp: now,
      data,
    }

    return data
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

    const rate = data.rates[toCurrency]

    if (!rate) {
      throw new Error(`Exchange rate not found for ${toCurrency}`)
    }

    const convertedAmount = amount * rate

    return {
      success: true,
      fromCurrency,
      toCurrency,
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
      if (data.rates[currency]) {
        rates[currency] = data.rates[currency]
      }
    }

    return {
      success: true,
      baseCurrency,
      rates,
      lastUpdated: new Date(data.time_last_update_unix * 1000).toISOString(),
    }
  } catch (error) {
    console.error("Error fetching multiple rates:", error)
    throw new Error("Failed to fetch multiple rates")
  }
}
