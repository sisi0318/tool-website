import { NextResponse } from "next/server"

// 简单的内存缓存实现
interface CacheItem {
  data: any
  timestamp: number
}

const CACHE_DURATION = 8 * 60 * 60 * 1000 // 8小时，单位毫秒
const ipCache = new Map<string, CacheItem>()

export async function GET(request: Request) {
  try {
    // Get the IP from the query parameter
    const { searchParams } = new URL(request.url)
    const ip = searchParams.get("ip")

    if (!ip) {
      return NextResponse.json({ error: "IP parameter is required" }, { status: 400 })
    }

    // 检查缓存
    const now = Date.now()
    const cachedItem = ipCache.get(ip)

    if (cachedItem && now - cachedItem.timestamp < CACHE_DURATION) {
      console.log(`Using cached IP info for ${ip}`)
      return NextResponse.json(cachedItem.data)
    }

    // Try the bt.cn API first
    try {
      console.log(`Fetching IP info for ${ip} from bt.cn API`)
      const response = await fetch(`http://www.bt.cn/api/panel/get_ip_info?ip=${ip}`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; DeviceInfoTool/1.0)",
        },
        cache: "no-store",
      })

      if (!response.ok) {
        throw new Error(`BT API responded with status: ${response.status}`)
      }

      const data = await response.json()
      console.log("BT API response:", data)

      // 缓存结果
      const result = {
        source: "bt",
        data,
      }
      ipCache.set(ip, { data: result, timestamp: now })

      // Return the data directly
      return NextResponse.json(result)
    } catch (btError) {
      console.error("BT API error:", btError)
      // If bt.cn API fails, fall back to ipapi.co
      const fallbackResponse = await fetch(`https://ipapi.co/${ip}/json/`, {
        cache: "no-store",
      })

      if (!fallbackResponse.ok) {
        throw new Error(`Fallback API responded with status: ${fallbackResponse.status}`)
      }

      const fallbackData = await fallbackResponse.json()
      console.log("Fallback API response:", fallbackData)

      // 缓存结果
      const result = {
        source: "ipapi",
        data: fallbackData,
      }
      ipCache.set(ip, { data: result, timestamp: now })

      return NextResponse.json(result)
    }
  } catch (error) {
    console.error("IP info error:", error)
    return NextResponse.json({ error: "Failed to fetch IP information" }, { status: 500 })
  }
}
