import { NextResponse } from "next/server"

// 标记为动态路由
export const dynamic = 'force-dynamic'

// 简单的内存缓存实现
interface CacheItem {
  data: any
  timestamp: number
}

const CACHE_DURATION = 8 * 60 * 60 * 1000 // 8小时，单位毫秒
const MAX_CACHE_ENTRIES = 500
const ipCache = new Map<string, CacheItem>()

const IPV4_PATTERN = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/

// 只接受合法的 IPv4/IPv6 字面量，拒绝任何可注入上游 URL 的字符
function isValidIp(value: string): boolean {
  const v4 = value.match(IPV4_PATTERN)
  if (v4) return v4.slice(1).every((part) => Number(part) <= 255)
  return value.length <= 45 && value.includes(":") && /^[0-9a-fA-F:.]+$/.test(value)
}

function cacheResult(ip: string, data: unknown, now: number) {
  if (ipCache.size >= MAX_CACHE_ENTRIES) {
    // 先清理过期条目
    for (const [key, item] of ipCache) {
      if (now - item.timestamp >= CACHE_DURATION) {
        ipCache.delete(key)
      }
    }
    // 仍然满员时，按插入顺序淘汰最旧的条目
    while (ipCache.size >= MAX_CACHE_ENTRIES) {
      const oldest = ipCache.keys().next().value
      if (oldest === undefined) break
      ipCache.delete(oldest)
    }
  }
  ipCache.set(ip, { data, timestamp: now })
}

export async function GET(request: Request) {
  try {
    // Get the IP from the query parameter
    const { searchParams } = new URL(request.url)
    const ip = searchParams.get("ip")

    if (!ip) {
      return NextResponse.json({ error: "IP parameter is required" }, { status: 400 })
    }

    if (!isValidIp(ip)) {
      return NextResponse.json({ error: "Invalid IP address" }, { status: 400 })
    }

    // 检查缓存
    const now = Date.now()
    const cachedItem = ipCache.get(ip)

    if (cachedItem && now - cachedItem.timestamp < CACHE_DURATION) {
      return NextResponse.json(cachedItem.data)
    }

    // Try the bt.cn API first
    try {
      const response = await fetch(
        `https://www.bt.cn/api/panel/get_ip_info?ip=${encodeURIComponent(ip)}`,
        {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; DeviceInfoTool/1.0)",
          },
          cache: "no-store",
        },
      )

      if (!response.ok) {
        throw new Error(`BT API responded with status: ${response.status}`)
      }

      const data = await response.json()

      // 缓存结果
      const result = {
        source: "bt",
        data,
      }
      cacheResult(ip, result, now)

      // Return the data directly
      return NextResponse.json(result)
    } catch (btError) {
      // If bt.cn API fails, fall back to ipapi.co
      const fallbackResponse = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
        cache: "no-store",
      })

      if (!fallbackResponse.ok) {
        throw new Error(`Fallback API responded with status: ${fallbackResponse.status}`)
      }

      const fallbackData = await fallbackResponse.json()

      // 缓存结果
      const result = {
        source: "ipapi",
        data: fallbackData,
      }
      cacheResult(ip, result, now)

      return NextResponse.json(result)
    }
  } catch (error) {
    console.error("IP info error:", error)
    return NextResponse.json({ error: "Failed to fetch IP information" }, { status: 500 })
  }
}
