"use client"

import { useState, useEffect, useCallback } from "react"
import { useTranslations } from "@/hooks/use-translations"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowRightLeft, RefreshCw, TrendingUp, Info, Clock, Plus, X, Settings, ChevronUp, ChevronDown, Zap, Copy, Check } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { getAllExchangeRates } from "./actions"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"

// 本地存储键名
const SELECTED_CURRENCIES_KEY = "currency_selected_currencies"
const MULTI_CURRENCIES_KEY = "currency_multi_currencies"
const ACTIVE_TAB_KEY = "currency_active_tab"

// 货币数据
const currencies = [
  { code: "USD", name: "美元", symbol: "$", flag: "🇺🇸" },
  { code: "EUR", name: "欧元", symbol: "€", flag: "🇪🇺" },
  { code: "JPY", name: "日元", symbol: "¥", flag: "🇯🇵" },
  { code: "GBP", name: "英镑", symbol: "£", flag: "🇬🇧" },
  { code: "AUD", name: "澳元", symbol: "A$", flag: "🇦🇺" },
  { code: "CAD", name: "加元", symbol: "C$", flag: "🇨🇦" },
  { code: "CHF", name: "瑞士法郎", symbol: "Fr", flag: "🇨🇭" },
  { code: "CNY", name: "人民币", symbol: "¥", flag: "🇨🇳" },
  { code: "HKD", name: "港币", symbol: "HK$", flag: "🇭🇰" },
  { code: "NZD", name: "新西兰元", symbol: "NZ$", flag: "🇳🇿" },
  { code: "SEK", name: "瑞典克朗", symbol: "kr", flag: "🇸🇪" },
  { code: "KRW", name: "韩元", symbol: "₩", flag: "🇰🇷" },
  { code: "SGD", name: "新加坡元", symbol: "S$", flag: "🇸🇬" },
  { code: "NOK", name: "挪威克朗", symbol: "kr", flag: "🇳🇴" },
  { code: "MXN", name: "墨西哥比索", symbol: "$", flag: "🇲🇽" },
  { code: "INR", name: "印度卢比", symbol: "₹", flag: "🇮🇳" },
  { code: "RUB", name: "俄罗斯卢布", symbol: "₽", flag: "🇷🇺" },
  { code: "ZAR", name: "南非兰特", symbol: "R", flag: "🇿🇦" },
  { code: "TRY", name: "土耳其里拉", symbol: "₺", flag: "🇹🇷" },
  { code: "BRL", name: "巴西雷亚尔", symbol: "R$", flag: "🇧🇷" },
  { code: "THB", name: "泰铢", symbol: "฿", flag: "🇹🇭" },
  { code: "AED", name: "阿联酋迪拉姆", symbol: "د.إ", flag: "🇦🇪" },
  { code: "PHP", name: "菲律宾比索", symbol: "₱", flag: "🇵🇭" },
  { code: "MYR", name: "马来西亚林吉特", symbol: "RM", flag: "🇲🇾" },
  { code: "PLN", name: "波兰兹罗提", symbol: "zł", flag: "🇵🇱" },
]

// 客户端缓存相关常量
const CLIENT_CACHE_TTL = 60 * 60 * 1000 // 1小时缓存
const CACHE_KEY = "currency_rates_all"

// 客户端缓存接口
interface ClientCacheItem {
  timestamp: number
  data: {
    baseCurrency: string
    rates: Record<string, number>
    lastUpdated: string
  }
}

// 汇率计算器接口
interface RateCalculator {
  convert: (amount: number, fromCurrency: string, toCurrency: string) => number
  getRate: (fromCurrency: string, toCurrency: string) => number
  getLastUpdated: () => string
  getAllRates: (baseCurrency: string) => Record<string, number>
}

export default function CurrencyConverterPage() {
  const t = useTranslations("currency")

  // 基础状态
  const [showCurrencyInfo, setShowCurrencyInfo] = useState(false)
  const [autoMode, setAutoMode] = useState(true)
  const [autoSwitch, setAutoSwitch] = useState(true)
  const [copied, setCopied] = useState<{ [key: string]: boolean }>({})

  // 原有状态
  const [amount, setAmount] = useState<string>("1")
  const [fromCurrency, setFromCurrency] = useState<string>("USD")
  const [toCurrency, setToCurrency] = useState<string>("CNY")
  const [result, setResult] = useState<number | null>(null)
  const [rate, setRate] = useState<number | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string>("")
  const [conversionHistory, setConversionHistory] = useState<
    Array<{
      from: string
      to: string
      amount: number
      result: number
      timestamp: string
    }>
  >([])

  const [multiRates, setMultiRates] = useState<{ [key: string]: { rate: number; convertedAmount: number } }>({})
  const [selectedCurrencies, setSelectedCurrencies] = useState<string[]>([])
  const [newCurrency, setNewCurrency] = useState<string>("")
  const [activeTab, setActiveTab] = useState<string>("single")

  const [multiCurrencies, setMultiCurrencies] = useState<string[]>(["CNY", "USD", "EUR", "JPY"])
  const [multiCurrencyValues, setMultiCurrencyValues] = useState<Record<string, string>>({})
  const [baseCurrencyForMulti, setBaseCurrencyForMulti] = useState<string | null>(null)

  // 汇率计算器
  const [rateCalculator, setRateCalculator] = useState<RateCalculator | null>(null)

  // 复制到剪贴板
  const copyToClipboard = (text: string, key: string = "main") => {
    if (!text) return

    navigator.clipboard.writeText(text).then(() => {
      setCopied(prev => ({ ...prev, [key]: true }))

      setTimeout(() => {
        setCopied(prev => ({ ...prev, [key]: false }))
      }, 2000)
    })
  }

  // 检查客户端缓存是否有效
  const checkClientCache = (): ClientCacheItem | null => {
    try {
      // 只在客户端执行
      if (typeof window === "undefined") return null

      const cachedData = localStorage.getItem(CACHE_KEY)

      if (!cachedData) return null

      const parsedCache: ClientCacheItem = JSON.parse(cachedData)
      const now = Date.now()

      // 检查缓存是否过期
      if (now - parsedCache.timestamp < CLIENT_CACHE_TTL) {
        return parsedCache
      }

      // 缓存过期，删除它
      localStorage.removeItem(CACHE_KEY)
      return null
    } catch (error) {
      console.error("Error checking client cache:", error)
      return null
    }
  }

  // 保存数据到客户端缓存
  const saveToClientCache = (data: any) => {
    try {
      // 只在客户端执行
      if (typeof window === "undefined") return

      const cacheItem: ClientCacheItem = {
        timestamp: Date.now(),
        data: {
          baseCurrency: data.baseCurrency,
          rates: data.rates,
          lastUpdated: data.lastUpdated,
        },
      }

      localStorage.setItem(CACHE_KEY, JSON.stringify(cacheItem))
    } catch (error) {
      console.error("Error saving to client cache:", error)
    }
  }

  // 创建汇率计算器
  const createRateCalculator = (data: any): RateCalculator => {
    const baseRates = data.rates
    const baseCurrency = data.baseCurrency
    const lastUpdatedTime = data.lastUpdated

    // 计算任意两种货币之间的汇率
    const getRate = (fromCurrency: string, toCurrency: string): number => {
      // 如果是基础货币，直接返回汇率
      if (fromCurrency === baseCurrency) {
        return baseRates[toCurrency] || 0
      }

      // 如果目标货币是基础货币
      if (toCurrency === baseCurrency) {
        return 1 / (baseRates[fromCurrency] || 1)
      }

      // 通过基础货币进行转换
      const fromRate = baseRates[fromCurrency] || 0
      const toRate = baseRates[toCurrency] || 0

      if (fromRate === 0) return 0

      // 计算跨货币汇率
      return toRate / fromRate
    }

    // 转换金额
    const convert = (amount: number, fromCurrency: string, toCurrency: string): number => {
      const conversionRate = getRate(fromCurrency, toCurrency)
      return amount * conversionRate
    }

    // 获取最后更新时间
    const getLastUpdated = (): string => {
      return lastUpdatedTime
    }

    // 获取指定基础货币的所有汇率
    const getAllRates = (baseCurrency: string): Record<string, number> => {
      if (baseCurrency === data.baseCurrency) {
        return { ...baseRates }
      }

      // 如果请求的基础货币不是数据的基础货币，需要重新计算所有汇率
      const rates: Record<string, number> = {}
      const baseRate = baseRates[baseCurrency] || 0

      if (baseRate === 0) return {}

      // 添加基础货币到目标货币的汇率
      rates[data.baseCurrency] = 1 / baseRate

      // 计算所有其他货币的汇率
      Object.entries(baseRates).forEach(([currency, rate]) => {
        if (currency !== baseCurrency && typeof rate === "number") {
          rates[currency] = rate / baseRate
        }
      })

      return rates
    }

    return {
      convert,
      getRate,
      getLastUpdated,
      getAllRates,
    }
  }

  // 保存用户选择的货币到本地存储
  const saveSelectedCurrenciesToLocalStorage = useCallback((currencies: string[]) => {
    if (typeof window === "undefined") return
    try {
      localStorage.setItem(SELECTED_CURRENCIES_KEY, JSON.stringify(currencies))
    } catch (error) {
      console.error("Error saving selected currencies to localStorage:", error)
    }
  }, [])

  // 保存多币种转换的货币列表到本地存储
  const saveMultiCurrenciesToLocalStorage = useCallback((currencies: string[]) => {
    if (typeof window === "undefined") return
    try {
      localStorage.setItem(MULTI_CURRENCIES_KEY, JSON.stringify(currencies))
    } catch (error) {
      console.error("Error saving multi currencies to localStorage:", error)
    }
  }, [])

  // 保存当前活动标签页到本地存储
  const saveActiveTabToLocalStorage = useCallback((tab: string) => {
    if (typeof window === "undefined") return
    try {
      localStorage.setItem(ACTIVE_TAB_KEY, tab)
    } catch (error) {
      console.error("Error saving active tab to localStorage:", error)
    }
  }, [])

  // 获取汇率数据
  const fetchRates = async () => {
    setLoading(true)
    setError(null)

    try {
      // 首先检查客户端缓存
      const cachedData = checkClientCache()

      if (cachedData) {
        // 使用缓存数据
        console.log("Using client cached data")
        const calculator = createRateCalculator(cachedData.data)
        setRateCalculator(calculator)
        setLastUpdated(new Date(cachedData.data.lastUpdated).toLocaleString())
      } else {
        // 从服务器获取数据
        console.log("Fetching fresh data")
        const data = await getAllExchangeRates()

        // 创建汇率计算器
        const calculator = createRateCalculator(data)
        setRateCalculator(calculator)
        setLastUpdated(new Date(data.lastUpdated).toLocaleString())

        // 保存到客户端缓存
        saveToClientCache(data)
      }
    } catch (err) {
      console.error("Error fetching rates:", err)
      setError(t("conversionError"))
    } finally {
      setLoading(false)
    }
  }

  // 计算转换结果
  const calculateConversion = () => {
    if (!rateCalculator || !amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      return
    }

    try {
      // 计算单一转换结果
      const amountNum = Number(amount)
      const currentRate = rateCalculator.getRate(fromCurrency, toCurrency)
      const convertedAmount = rateCalculator.convert(amountNum, fromCurrency, toCurrency)

      setRate(currentRate)
      setResult(convertedAmount)

      // 计算多货币汇率
      const rates: { [key: string]: { rate: number; convertedAmount: number } } = {}
      const defaultTargets = getDefaultTargets(fromCurrency)
      const allTargets = [...new Set([...defaultTargets, ...selectedCurrencies, toCurrency])].filter(
        (c) => c !== fromCurrency,
      )

      allTargets.forEach((currency) => {
        const currRate = rateCalculator.getRate(fromCurrency, currency)
        rates[currency] = {
          rate: currRate,
          convertedAmount: amountNum * currRate,
        }
      })

      setMultiRates(rates)

      // 添加到转换历史
      const historyItem = {
        from: fromCurrency,
        to: toCurrency,
        amount: amountNum,
        result: convertedAmount,
        timestamp: new Date().toISOString(),
      }

      setConversionHistory((prev) => {
        // 保留最近10条记录
        const newHistory = [historyItem, ...prev]
        if (newHistory.length > 10) {
          return newHistory.slice(0, 10)
        }
        return newHistory
      })
    } catch (err) {
      console.error("Calculation error:", err)
      setError(t("conversionError"))
    }
  }

  // 获取默认的多货币目标列表
  const getDefaultTargets = (baseCurrency: string) => {
    // 默认显示的常用货币：人民币、美元、日元、英镑
    const popularCurrencies = ["CNY", "USD", "JPY", "GBP"]

    // 过滤掉基础货币
    return popularCurrencies.filter((c) => c !== baseCurrency)
  }

  // 交换货币
  const swapCurrencies = () => {
    const newFromCurrency = toCurrency
    const newToCurrency = fromCurrency
    
    setFromCurrency(newFromCurrency)
    setToCurrency(newToCurrency)
    
    // 如果是自动模式且有有效金额，立即重新计算
    if (autoSwitch && autoMode && amount && !isNaN(Number(amount)) && Number(amount) > 0 && rateCalculator) {
      setTimeout(() => {
        const amountNum = Number(amount)
        const currentRate = rateCalculator.getRate(newFromCurrency, newToCurrency)
        const convertedAmount = rateCalculator.convert(amountNum, newFromCurrency, newToCurrency)

        setRate(currentRate)
        setResult(convertedAmount)

        // 重新计算多货币汇率
        const rates: { [key: string]: { rate: number; convertedAmount: number } } = {}
        const defaultTargets = getDefaultTargets(newFromCurrency)
        const allTargets = [...new Set([...defaultTargets, ...selectedCurrencies, newToCurrency])].filter(
          (c) => c !== newFromCurrency,
        )

        allTargets.forEach((currency) => {
          const currRate = rateCalculator.getRate(newFromCurrency, currency)
          rates[currency] = {
            rate: currRate,
            convertedAmount: amountNum * currRate,
          }
        })

        setMultiRates(rates)
      }, 100)
    } else if (!autoMode && result !== null) {
      // 手动模式下，如果有结果则提示重新计算
      setTimeout(() => {
        calculateConversion()
      }, 100)
    }
  }

  // 初始加载时获取汇率数据和恢复保存的状态
  useEffect(() => {
    fetchRates()

    // 从本地存储恢复用户选择的货币
    if (typeof window !== "undefined") {
      try {
        // 恢复选择的货币
        const savedSelectedCurrencies = localStorage.getItem(SELECTED_CURRENCIES_KEY)
        if (savedSelectedCurrencies) {
          setSelectedCurrencies(JSON.parse(savedSelectedCurrencies))
        }

        // 恢复多币种转换的货币列表
        const savedMultiCurrencies = localStorage.getItem(MULTI_CURRENCIES_KEY)
        if (savedMultiCurrencies) {
          setMultiCurrencies(JSON.parse(savedMultiCurrencies))
        }

        // 恢复活动标签页
        const savedActiveTab = localStorage.getItem(ACTIVE_TAB_KEY)
        if (savedActiveTab) {
          setActiveTab(savedActiveTab)
        }
      } catch (error) {
        console.error("Error restoring state from localStorage:", error)
      }
    }
  }, [])

  // 修改handleAmountChange函数，确保在金额变化时立即更新结果
  const handleAmountChange = (value: string) => {
    // 只允许数字和小数点
    const regex = /^[0-9]*\.?[0-9]*$/
    if (value === "" || regex.test(value)) {
      setAmount(value)

      // 如果金额有效，清除错误提示并根据模式计算转换结果
      if (value !== "" && !isNaN(Number(value)) && Number(value) > 0) {
        setError(null)

        // 只有在自动模式下才实时计算
        if (autoMode && rateCalculator) {
          const amountNum = Number(value)
          const currentRate = rateCalculator.getRate(fromCurrency, toCurrency)
          const convertedAmount = rateCalculator.convert(amountNum, fromCurrency, toCurrency)

          setRate(currentRate)
          setResult(convertedAmount)

          // 计算多货币汇率
          const rates: { [key: string]: { rate: number; convertedAmount: number } } = {}
          const defaultTargets = getDefaultTargets(fromCurrency)
          const allTargets = [...new Set([...defaultTargets, ...selectedCurrencies, toCurrency])].filter(
            (c) => c !== fromCurrency,
          )

          allTargets.forEach((currency) => {
            const currRate = rateCalculator.getRate(fromCurrency, currency)
            rates[currency] = {
              rate: currRate,
              convertedAmount: amountNum * currRate,
            }
          })

          setMultiRates(rates)
        }
      } else if (value === "") {
        // 如果输入为空，清除错误但不触发转换
        setError(null)
        if (autoMode) {
          setResult(null)
        }
      } else {
        // 如果输入无效，显示错误
        setError("请输入有效金额")
      }
    }
  }

  // 添加新货币到多货币汇率计算
  const addCurrency = () => {
    if (newCurrency && !selectedCurrencies.includes(newCurrency) && newCurrency !== fromCurrency) {
      const updatedCurrencies = [...selectedCurrencies, newCurrency]
      setSelectedCurrencies(updatedCurrencies)
      setNewCurrency("")

      // 保存到本地存储
      saveSelectedCurrenciesToLocalStorage(updatedCurrencies)

      // 如果已经有金额，立即更新结果
      if (amount && !isNaN(Number(amount)) && Number(amount) > 0 && rateCalculator) {
        // 直接计算新添加的货币汇率，而不是调用calculateConversion
        const amountNum = Number(amount)
        const newCurrRate = rateCalculator.getRate(fromCurrency, newCurrency)
        const newCurrAmount = rateCalculator.convert(amountNum, fromCurrency, newCurrency)

        // 更新多货币汇率，添加新货币的汇率
        setMultiRates((prev) => ({
          ...prev,
          [newCurrency]: {
            rate: newCurrRate,
            convertedAmount: newCurrAmount,
          },
        }))
      }
    }
  }

  // 从多货币汇率计算中移除货币
  const removeCurrency = (currency: string) => {
    const updatedCurrencies = selectedCurrencies.filter((c) => c !== currency)
    setSelectedCurrencies(updatedCurrencies)

    // 保存到本地存储
    saveSelectedCurrenciesToLocalStorage(updatedCurrencies)
  }

  // 刷新汇率按钮点击处理
  const handleRefreshRates = () => {
    // 保存当前状态
    const currentTab = activeTab
    const currentAmount = amount
    const currentFromCurrency = fromCurrency
    const currentToCurrency = toCurrency
    const currentMultiCurrencies = [...multiCurrencies]
    const currentMultiCurrencyValues = { ...multiCurrencyValues }
    const currentBaseCurrencyForMulti = baseCurrencyForMulti

    // 强制刷新，清除客户端缓存
    if (typeof window !== "undefined") {
      localStorage.removeItem(CACHE_KEY)
    }

    // 设置加载状态
    setLoading(true)

    // 获取新汇率
    fetchRates().then(() => {
      // 恢复之前的状态
      setActiveTab(currentTab)
      setAmount(currentAmount)
      setFromCurrency(currentFromCurrency)
      setToCurrency(currentToCurrency)
      setMultiCurrencies(currentMultiCurrencies)

      // 在获取新汇率后，重新计算转换结果
      setTimeout(() => {
        if (currentTab === "multiInput" && rateCalculator && currentBaseCurrencyForMulti) {
          // 恢复多币种转换的状态
          const baseValue = currentMultiCurrencyValues[currentBaseCurrencyForMulti]
          if (baseValue && !isNaN(Number(baseValue))) {
            handleMultiCurrencyChange(currentBaseCurrencyForMulti, baseValue)
          }
        } else {
          // 重新计算单一转换或多汇率显示
          calculateConversion()
        }
      }, 100)
    })
  }

  // 获取货币信息
  const getCurrencyInfo = (code: string) => {
    return currencies.find((c) => c.code === code) || { code, name: code, symbol: "", flag: "" }
  }

  const fromCurrencyInfo = getCurrencyInfo(fromCurrency)
  const toCurrencyInfo = getCurrencyInfo(toCurrency)

  // 格式化数字，添加千位分隔符
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num)
  }

  // Sort currencies with CNY first
  const sortWithCNYFirst = useCallback((currencies: string[]) => {
    const hasCNY = currencies.includes("CNY")
    if (hasCNY) {
      return ["CNY", ...currencies.filter((code) => code !== "CNY")]
    }
    return currencies
  }, [])

  // Add a currency to the multi-currency converter
  const addMultiCurrency = useCallback(() => {
    if (newCurrency && !multiCurrencies.includes(newCurrency)) {
      const updatedCurrencies = [...multiCurrencies, newCurrency]
      setMultiCurrencies(updatedCurrencies)
      setNewCurrency("")

      // 保存到本地存储
      saveMultiCurrenciesToLocalStorage(updatedCurrencies)

      // 如果已经有基础货币和值，立即计算新货币的值
      if (baseCurrencyForMulti && multiCurrencyValues[baseCurrencyForMulti] && rateCalculator) {
        const baseValue = Number(multiCurrencyValues[baseCurrencyForMulti])
        if (!isNaN(baseValue)) {
          // 计算新货币的转换值
          const convertedAmount = rateCalculator.convert(baseValue, baseCurrencyForMulti, newCurrency)

          // 更新多币种值，添加新货币的值
          setMultiCurrencyValues((prev) => ({
            ...prev,
            [newCurrency]: convertedAmount.toFixed(2),
          }))
        }
      }
    }
  }, [
    newCurrency,
    multiCurrencies,
    saveMultiCurrenciesToLocalStorage,
    baseCurrencyForMulti,
    multiCurrencyValues,
    rateCalculator,
  ])

  // Remove a currency from the multi-currency converter
  const removeMultiCurrency = useCallback(
    (currencyCode: string) => {
      const updatedCurrencies = multiCurrencies.filter((code) => code !== currencyCode)
      setMultiCurrencies(updatedCurrencies)
      setMultiCurrencyValues((prev) => {
        const newValues = { ...prev }
        delete newValues[currencyCode]
        return newValues
      })

      // 保存到本地存储
      saveMultiCurrenciesToLocalStorage(updatedCurrencies)

      // If this was the base currency, reset it
      if (baseCurrencyForMulti === currencyCode) {
        setBaseCurrencyForMulti(null)
      }
    },
    [baseCurrencyForMulti, multiCurrencies, saveMultiCurrenciesToLocalStorage],
  )

  // Handle input change in any of the multi-currency inputs
  const handleMultiCurrencyChange = useCallback(
    (currencyCode: string, value: string) => {
      // Only allow numbers and decimal point
      if (value !== "" && !/^\d*\.?\d*$/.test(value)) {
        return
      }

      // Update the value for this currency
      setMultiCurrencyValues((prev) => ({
        ...prev,
        [currencyCode]: value,
      }))

      // Set this as the base currency for conversions
      setBaseCurrencyForMulti(currencyCode)

      // If the value is valid, update all other currencies
      if (value !== "" && !isNaN(Number(value)) && rateCalculator) {
        const amount = Number(value)
        const newValues: Record<string, string> = { [currencyCode]: value }

        multiCurrencies.forEach((code) => {
          if (code !== currencyCode) {
            const convertedAmount = rateCalculator.convert(amount, currencyCode, code)
            newValues[code] = convertedAmount.toFixed(2)
          }
        })

        setMultiCurrencyValues(newValues)
      }
    },
    [multiCurrencies, rateCalculator],
  )

  // 当活动标签页变化时保存到本地存储
  useEffect(() => {
    saveActiveTabToLocalStorage(activeTab)
  }, [activeTab, saveActiveTabToLocalStorage])

  // 货币切换时自动重新计算（自动切换模式）
  useEffect(() => {
    if (autoSwitch && autoMode && amount && !isNaN(Number(amount)) && Number(amount) > 0 && rateCalculator) {
      const amountNum = Number(amount)
      const currentRate = rateCalculator.getRate(fromCurrency, toCurrency)
      const convertedAmount = rateCalculator.convert(amountNum, fromCurrency, toCurrency)

      setRate(currentRate)
      setResult(convertedAmount)

      // 重新计算多货币汇率
      const rates: { [key: string]: { rate: number; convertedAmount: number } } = {}
      const defaultTargets = getDefaultTargets(fromCurrency)
      const allTargets = [...new Set([...defaultTargets, ...selectedCurrencies, toCurrency])].filter(
        (c) => c !== fromCurrency,
      )

      allTargets.forEach((currency) => {
        const currRate = rateCalculator.getRate(fromCurrency, currency)
        rates[currency] = {
          rate: currRate,
          convertedAmount: amountNum * currRate,
        }
      })

      setMultiRates(rates)
    }
  }, [fromCurrency, toCurrency, autoSwitch, autoMode, amount, rateCalculator, selectedCurrencies])

  // Initialize default values when rates are loaded
  useEffect(() => {
    if (rateCalculator && multiCurrencies.length > 0 && Object.keys(multiCurrencyValues).length === 0) {
      // Set initial value for CNY or first currency
      const initialCurrency = multiCurrencies.includes("CNY") ? "CNY" : multiCurrencies[0]
      const initialAmount = 1

      const initialValues: Record<string, string> = { [initialCurrency]: initialAmount.toString() }

      multiCurrencies.forEach((code) => {
        if (code !== initialCurrency) {
          const convertedAmount = rateCalculator.convert(initialAmount, initialCurrency, code)
          initialValues[code] = convertedAmount.toFixed(2)
        }
      })

      setMultiCurrencyValues(initialValues)
      setBaseCurrencyForMulti(initialCurrency)
    }
  }, [rateCalculator, multiCurrencies, multiCurrencyValues])

  return (
    <div className="container mx-auto px-4 py-4 max-w-6xl">
      {/* 页面标题 */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200 mb-4 flex items-center justify-center gap-2">
          <TrendingUp className="h-8 w-8 text-green-600" />
          汇率转换器
        </h1>
      </div>

      {/* 汇率设置折叠区域 */}
      <div className="mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowCurrencyInfo(!showCurrencyInfo)}
          className="w-full text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
        >
          <div className="flex items-center gap-2">
            {showCurrencyInfo ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
            <Settings className="h-4 w-4" />
            <span>汇率设置</span>
            {!showCurrencyInfo && (
              <Badge variant="secondary" className="text-xs ml-auto">
                点击查看
              </Badge>
            )}
          </div>
        </Button>

        {showCurrencyInfo && (
          <Card className="mt-3 card-modern">
            <CardContent className="py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
                  <Label htmlFor="auto-mode" className="cursor-pointer text-sm">
                    手动模式
                  </Label>
                  <Switch id="auto-mode" checked={autoMode} onCheckedChange={setAutoMode} />
                  <Label htmlFor="auto-mode" className="cursor-pointer text-sm text-blue-600">
                    实时转换
                  </Label>
                </div>
                <div className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
                  <Label htmlFor="auto-switch" className="cursor-pointer text-sm">
                    手动切换
                  </Label>
                  <Switch id="auto-switch" checked={autoSwitch} onCheckedChange={setAutoSwitch} />
                  <Label htmlFor="auto-switch" className="cursor-pointer text-sm text-green-600">
                    智能切换
                  </Label>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="space-y-6">
        {/* 转换表单 */}
        <Card className="card-modern">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              汇率转换
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-6">
              {/* 金额输入 */}
              <div className="space-y-2">
                <Label htmlFor="amount" className="text-sm font-medium">金额</Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <span className="text-gray-500">{fromCurrencyInfo.symbol}</span>
                  </div>
                  <Input
                    id="amount"
                    type="text"
                    value={amount}
                    onChange={(e) => handleAmountChange(e.target.value)}
                    className="pl-8 h-12 text-lg"
                    placeholder="1.00"
                  />
                </div>
              </div>

              {/* 货币选择器 */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">货币对</Label>
                
                {/* 桌面布局 */}
                <div className="hidden sm:grid sm:grid-cols-5 sm:gap-4 sm:items-center">
                  <div className="col-span-2">
                    <Label className="text-xs text-gray-500 mb-1 block">从</Label>
                    <Select value={fromCurrency} onValueChange={setFromCurrency}>
                      <SelectTrigger className="h-12">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={5} align="start">
                        {currencies.map((currency) => (
                          <SelectItem key={`desktop-from-${currency.code}`} value={currency.code}>
                            <div className="flex items-center">
                              <span className="mr-2">{currency.flag}</span>
                              <span className="font-medium">{currency.code}</span>
                              <span className="ml-2 text-gray-500 text-sm">- {currency.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex justify-center items-center mt-6">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="outline" size="icon" onClick={swapCurrencies} className="h-12 w-12 rounded-full">
                            <ArrowRightLeft className="h-5 w-5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>交换货币</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>

                  <div className="col-span-2">
                    <Label className="text-xs text-gray-500 mb-1 block">到</Label>
                    <Select value={toCurrency} onValueChange={setToCurrency}>
                      <SelectTrigger className="h-12">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={5} align="start">
                        {currencies.map((currency) => (
                          <SelectItem key={`desktop-to-${currency.code}`} value={currency.code}>
                            <div className="flex items-center">
                              <span className="mr-2">{currency.flag}</span>
                              <span className="font-medium">{currency.code}</span>
                              <span className="ml-2 text-gray-500 text-sm">- {currency.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* 移动端布局 */}
                <div className="sm:hidden space-y-3">
                  <div>
                    <Label className="text-xs text-gray-500 mb-1 block">从</Label>
                    <Select value={fromCurrency} onValueChange={setFromCurrency}>
                      <SelectTrigger className="h-12">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={5} align="start">
                        {currencies.map((currency) => (
                          <SelectItem key={`mobile-from-${currency.code}`} value={currency.code}>
                            <div className="flex items-center">
                              <span className="mr-2">{currency.flag}</span>
                              <span className="font-medium">{currency.code}</span>
                              <span className="ml-2 text-gray-500 text-sm">- {currency.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex justify-center">
                    <Button variant="outline" size="icon" onClick={swapCurrencies} className="h-10 w-10 rounded-full">
                      <ArrowRightLeft className="h-4 w-4" />
                    </Button>
                  </div>

                  <div>
                    <Label className="text-xs text-gray-500 mb-1 block">到</Label>
                    <Select value={toCurrency} onValueChange={setToCurrency}>
                      <SelectTrigger className="h-12">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={5} align="start">
                        {currencies.map((currency) => (
                          <SelectItem key={`mobile-to-${currency.code}`} value={currency.code}>
                            <div className="flex items-center">
                              <span className="mr-2">{currency.flag}</span>
                              <span className="font-medium">{currency.code}</span>
                              <span className="ml-2 text-gray-500 text-sm">- {currency.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="flex gap-3">
                {!autoMode && (
                  <Button 
                    onClick={calculateConversion} 
                    disabled={loading || !rateCalculator} 
                    className="flex-1 h-12"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        计算中...
                      </>
                    ) : (
                      <>
                        <TrendingUp className="mr-2 h-4 w-4" />
                        立即转换
                      </>
                    )}
                  </Button>
                )}
                {autoMode && (
                  <div className="flex-1 flex items-center justify-center h-12 bg-blue-50 dark:bg-blue-900/20 rounded-lg border">
                    <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                      <Zap className="h-4 w-4" />
                      <span className="text-sm font-medium">实时转换已启用</span>
                    </div>
                  </div>
                )}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        onClick={handleRefreshRates} 
                        variant="outline" 
                        disabled={loading} 
                        className="h-12 px-4"
                      >
                        <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>刷新汇率数据</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 错误信息 */}
        {error && (
          <div className="bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-200 p-3 rounded-md">{error}</div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-10">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="single">{t("singleConversion")}</TabsTrigger>
            <TabsTrigger value="multi">{t("multipleRates")}</TabsTrigger>
            <TabsTrigger value="multiInput">{t("multiCurrencyInput")}</TabsTrigger>
          </TabsList>

          <TabsContent value="single" className="mt-6">
            {/* 结果显示 - 单一转换结果显示 */}
            <Card className="card-modern">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-blue-600" />
                  转换结果
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  {loading ? (
                    <div className="space-y-4">
                      <Skeleton className="h-16 w-full" />
                      <Skeleton className="h-6 w-3/4 mx-auto" />
                      <Skeleton className="h-4 w-1/2 mx-auto" />
                    </div>
                  ) : result !== null ? (
                    <>
                      <div className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 rounded-lg p-6 mb-4">
                        <div className="text-2xl md:text-3xl font-bold mb-2 text-gray-800 dark:text-gray-200">
                          <span className="text-lg">{fromCurrencyInfo.flag}</span>
                          <span className="mx-2">{formatNumber(Number(amount))}</span>
                          <span className="text-lg text-gray-600 dark:text-gray-400">{fromCurrencyInfo.code}</span>
                          <span className="mx-3 text-gray-400">=</span>
                          <span className="text-lg">{toCurrencyInfo.flag}</span>
                          <span className="mx-2 text-green-600 dark:text-green-400">{formatNumber(result)}</span>
                          <span className="text-lg text-gray-600 dark:text-gray-400">{toCurrencyInfo.code}</span>
                        </div>
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(`${formatNumber(result)} ${toCurrencyInfo.code}`, "result")}
                            className="text-xs text-gray-500 hover:text-gray-700"
                          >
                            {copied.result ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                            <span className="ml-1">复制结果</span>
                          </Button>
                        </div>
                      </div>
                      {rate && (
                        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-4">
                          <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">汇率</div>
                          <div className="font-medium">
                            1 {fromCurrencyInfo.code} = {rate.toFixed(6)} {toCurrencyInfo.code}
                          </div>
                        </div>
                      )}
                      <div className="flex items-center justify-center text-xs text-gray-500 dark:text-gray-400">
                        <Clock className="h-3 w-3 mr-1" />
                        最后更新: {lastUpdated}
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3 w-3 ml-1 cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs">数据来源于实时汇率API</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-8">
                      <TrendingUp className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                      <div className="text-gray-500 dark:text-gray-400">输入金额开始转换</div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="multi">
            {/* 多汇率显示 */}
            <div className="p-4">
              <div className="text-center mb-4">
                <h3 className="text-lg font-medium">
                  {t("multipleRatesFor")} {fromCurrencyInfo.flag} {fromCurrencyInfo.code}
                </h3>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {formatNumber(Number(amount))} {fromCurrencyInfo.code}
                </div>
              </div>

              {/* 添加货币选择器 */}
              <div className="mb-4 flex flex-col sm:flex-row gap-2">
                <div className="flex-1">
                  <Select value={newCurrency} onValueChange={setNewCurrency}>
                    <SelectTrigger>
                      <SelectValue placeholder="添加更多货币..." />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={5} align="start">
                      {currencies
                        .filter((c) => c.code !== fromCurrency && !selectedCurrencies.includes(c.code))
                        .map((currency) => (
                          <SelectItem key={currency.code} value={currency.code}>
                            <div className="flex items-center">
                              <span className="mr-2">{currency.flag}</span>
                              <span>{currency.code}</span>
                              <span className="ml-2 text-gray-500 hidden sm:inline">- {currency.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={addCurrency} disabled={!newCurrency} className="w-full sm:w-auto">
                  <Plus className="h-4 w-4 mr-1" />
                  添加
                </Button>
              </div>

              {/* 已选货币标签 */}
              {selectedCurrencies.length > 0 && (
                <div className="mb-4 flex flex-wrap gap-2">
                  {selectedCurrencies.map((code) => {
                    const currInfo = getCurrencyInfo(code)
                    return (
                      <Badge key={code} variant="secondary" className="flex items-center gap-1 py-1 px-2">
                        <span>{currInfo.flag}</span>
                        <span>{code}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-4 w-4 p-0 ml-1"
                          onClick={() => removeCurrency(code)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </Badge>
                    )
                  })}
                </div>
              )}

              {loading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {(() => {
                    // 先提取出所有货币代码
                    const currencyCodes = Object.keys(multiRates)

                    // 检查是否包含CNY
                    const hasCNY = currencyCodes.includes("CNY")

                    // 重新排序：如果有CNY，将其放在最前面
                    const sortedCodes = hasCNY
                      ? ["CNY", ...currencyCodes.filter((code) => code !== "CNY")]
                      : currencyCodes

                    // 按照新的顺序渲染
                    return sortedCodes.map((currCode) => {
                      const data = multiRates[currCode]
                      const currInfo = getCurrencyInfo(currCode)
                      return (
                        <div
                          key={currCode}
                          className="flex justify-between items-center p-3 bg-white dark:bg-gray-700 rounded-lg shadow-sm"
                        >
                          <div className="flex items-center">
                            <span className="text-xl mr-2">{currInfo.flag}</span>
                            <div>
                              <div className="font-medium">{currInfo.name}</div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">{currCode}</div>
                            </div>
                          </div>
                          <div className="flex flex-col items-end">
                            <div className="text-xl font-bold">{formatNumber(data.convertedAmount)}</div>
                            <div className="text-xs text-gray-500">
                              1 {fromCurrencyInfo.code} = {data.rate.toFixed(6)}
                            </div>
                          </div>
                        </div>
                      )
                    })
                  })()}
                </div>
              )}
            </div>
          </TabsContent>
          <TabsContent value="multiInput">
            <div className="p-4">
              <div className="text-center mb-4">
                <h3 className="text-lg font-medium">{t("multiCurrencyConverter")}</h3>
                <div className="text-sm text-gray-500 dark:text-gray-400">{t("multiCurrencyDescription")}</div>
              </div>

              {/* Currency selection */}
              <div className="mb-4 flex flex-col sm:flex-row gap-2">
                <div className="flex-1">
                  <Select value={newCurrency} onValueChange={setNewCurrency}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("addMoreCurrencies")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={5} align="start">
                      {currencies
                        .filter((c) => !multiCurrencies.includes(c.code))
                        .map((currency) => (
                          <SelectItem key={currency.code} value={currency.code}>
                            <div className="flex items-center">
                              <span className="mr-2">{currency.flag}</span>
                              <span>{currency.code}</span>
                              <span className="ml-2 text-gray-500 hidden sm:inline">- {currency.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={addMultiCurrency} disabled={!newCurrency} className="w-full sm:w-auto">
                  <Plus className="h-4 w-4 mr-1" />
                  {t("add")}
                </Button>
              </div>

              {/* Multi-currency converter */}
              {multiCurrencies.length > 0 ? (
                <div className="space-y-3">
                  {sortWithCNYFirst(multiCurrencies).map((currCode) => {
                    const currInfo = getCurrencyInfo(currCode)
                    return (
                      <div
                        key={currCode}
                        className="flex items-center space-x-2 p-3 bg-white dark:bg-gray-700 rounded-lg shadow-sm"
                      >
                        <div className="flex items-center min-w-[80px] sm:min-w-[120px]">
                          <span className="text-xl mr-1 sm:mr-2">{currInfo.flag}</span>
                          <div>
                            <div className="font-medium text-sm sm:text-base">{currInfo.code}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 hidden sm:block">
                              {currInfo.name}
                            </div>
                          </div>
                        </div>
                        <div className="relative flex-1">
                          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                            <span className="text-gray-500">{currInfo.symbol}</span>
                          </div>
                          <Input
                            type="text"
                            value={multiCurrencyValues[currCode] || ""}
                            onChange={(e) => handleMultiCurrencyChange(currCode, e.target.value)}
                            className="pl-12"
                            placeholder="0.00"
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeMultiCurrency(currCode)}
                          className="text-gray-500 hover:text-red-500 flex-shrink-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center p-8 border border-dashed rounded-lg">
                  <p>{t("selectCurrenciesToStart")}</p>
                </div>
              )}

              {/* Last updated info */}
              <div className="flex items-center justify-center text-xs text-gray-500 dark:text-gray-400 mt-4">
                <Clock className="h-3 w-3 mr-1" />
                {t("lastUpdated")}: {lastUpdated}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* 常用货币对 */}
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-4">{t("popularPairs")}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { from: "USD", to: "EUR" },
              { from: "EUR", to: "USD" },
              { from: "USD", to: "JPY" },
              { from: "USD", to: "GBP" },
              { from: "USD", to: "CNY" },
              { from: "EUR", to: "GBP" },
              { from: "GBP", to: "USD" },
              { from: "AUD", to: "USD" },
            ].map((pair, index) => {
              const fromInfo = getCurrencyInfo(pair.from)
              const toInfo = getCurrencyInfo(pair.to)

              return (
                <Button
                  key={index}
                  variant="outline"
                  className="justify-start py-3 h-auto overflow-hidden"
                  onClick={() => {
                    setFromCurrency(pair.from)
                    setToCurrency(pair.to)
                  }}
                >
                  <div className="flex items-center w-full">
                    <span className="mr-1">{fromInfo.flag}</span>
                    <span className="truncate">{pair.from}</span>
                    <ArrowRightLeft className="mx-1 h-3 w-3 flex-shrink-0" />
                    <span className="mr-1">{toInfo.flag}</span>
                    <span className="truncate">{pair.to}</span>
                  </div>
                </Button>
              )
            })}
          </div>
        </div>

        {/* 转换历史 */}
        {conversionHistory.length > 0 && (
          <div>
            <h3 className="text-lg font-medium mb-4">{t("conversionHistory")}</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                    >
                      {t("date")}
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                    >
                      {t("conversion")}
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                    >
                      {t("amount")}
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                    >
                      {t("result")}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
                  {conversionHistory.map((item, index) => {
                    const fromInfo = getCurrencyInfo(item.from)
                    const toInfo = getCurrencyInfo(item.to)
                    const date = new Date(item.timestamp)

                    return (
                      <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {date.toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex items-center">
                            <span className="mr-1">{fromInfo.flag}</span>
                            <span>{item.from}</span>
                            <ArrowRightLeft className="mx-1 h-3 w-3" />
                            <span className="mr-1">{toInfo.flag}</span>
                            <span>{item.to}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {formatNumber(item.amount)} {item.from}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          {formatNumber(item.result)} {item.to}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 缓存状态指示器 */}
        <div className="flex items-center justify-center text-xs text-gray-500 dark:text-gray-400">
          <Clock className="h-3 w-3 mr-1" />
          {t("lastUpdated")}: {lastUpdated}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3 w-3 ml-1 cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">{t("cacheInfo")}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* 免责声明 */}
        <div className="text-xs text-gray-500 dark:text-gray-400 border-t pt-4">{t("disclaimer")}</div>
      </div>
    </div>
  )
}
