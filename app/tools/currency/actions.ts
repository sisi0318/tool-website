"use server"

interface ExchangeRateResponse {
  result: string
  rates: Record<string, number>
  time_last_update_unix: number
  error?: string
}

const CACHE_TTL_SECONDS = 8 * 60 * 60
/**
 * 手动刷新只是缩短缓存窗口,而不是绕过缓存:server action 是公开端点,
 * `no-store` 会让任何人都能循环调用把上游免费额度打穿。
 */
const FORCED_REFRESH_TTL_SECONDS = 5 * 60
const UPSTREAM_TIMEOUT_MS = 5000

// 从ExchangeRate-API获取汇率数据
async function fetchExchangeRates(
  baseCurrency = "USD",
  forceRefresh = false,
): Promise<ExchangeRateResponse> {
  const normalizedCurrency = baseCurrency.trim().toUpperCase()
  if (!/^[A-Z]{3}$/.test(normalizedCurrency)) {
    throw new Error("Invalid base currency")
  }

  try {
    // 汇率是公开、无用户态的数据。Next 按完整 URL 隔离缓存。
    const response = await fetch(
      `https://open.er-api.com/v6/latest/${encodeURIComponent(normalizedCurrency)}`,
      {
        next: { revalidate: forceRefresh ? FORCED_REFRESH_TTL_SECONDS : CACHE_TTL_SECONDS },
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      },
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
export async function getAllExchangeRates(forceRefresh = false) {
  try {
    // 使用USD作为基础货币获取所有汇率
    const data = await fetchExchangeRates("USD", forceRefresh)

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
