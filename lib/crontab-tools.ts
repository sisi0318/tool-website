export interface ParsedCronExpression {
  seconds: string
  minutes: string
  hours: string
  dayOfMonth: string
  month: string
  dayOfWeek: string
  year: string
}

export function parseCronExpression(expression: string, includeSeconds = false): ParsedCronExpression | null {
  const parts = expression.trim().split(/\s+/).filter(Boolean)
  const expectedParts = includeSeconds ? 6 : 5
  if (parts.length !== expectedParts && parts.length !== expectedParts + 1) return null

  const [seconds, minutes, hours, dayOfMonth, month, dayOfWeek, year] = includeSeconds
    ? [parts[0], parts[1], parts[2], parts[3], parts[4], parts[5], parts[6] || ""]
    : ["0", parts[0], parts[1], parts[2], parts[3], parts[4], parts[5] || ""]

  return { seconds, minutes, hours, dayOfMonth, month, dayOfWeek, year }
}

export function expandCronField(field: string, min: number, max: number): number[] {
  if (!field || typeof field !== "string") return []
  if (field === "*" || field === "?") {
    return Array.from({ length: max - min + 1 }, (_, index) => min + index)
  }

  const values = new Set<number>()
  for (const rawPart of field.split(",")) {
    const part = rawPart.trim()
    if (!part) return []

    const [rangeExpression, stepExpression] = part.split("/")
    if (part.split("/").length > 2) return []

    const step = stepExpression === undefined ? 1 : Number.parseInt(stepExpression, 10)
    if (!Number.isInteger(step) || step <= 0) return []

    let start: number
    let end: number

    if (rangeExpression === "*") {
      start = min
      end = max
    } else if (rangeExpression.includes("-")) {
      const rangeParts = rangeExpression.split("-")
      if (rangeParts.length !== 2) return []
      start = Number.parseInt(rangeParts[0], 10)
      end = Number.parseInt(rangeParts[1], 10)
    } else {
      start = Number.parseInt(rangeExpression, 10)
      end = stepExpression === undefined ? start : max
    }

    if (!Number.isInteger(start) || !Number.isInteger(end) || start < min || end > max || start > end) {
      return []
    }

    for (let value = start; value <= end; value += step) values.add(value)
  }

  return [...values].sort((left, right) => left - right)
}

function expandDayOfWeek(field: string): number[] {
  return [...new Set(expandCronField(field === "?" ? "*" : field, 0, 7).map((value) => value === 7 ? 0 : value))]
    .sort((left, right) => left - right)
}

function dayMatches(
  date: Date,
  parsed: ParsedCronExpression,
  validDaysOfMonth: number[],
  validDaysOfWeek: number[],
): boolean {
  const dayOfMonthWildcard = parsed.dayOfMonth === "*" || parsed.dayOfMonth === "?"
  const dayOfWeekWildcard = parsed.dayOfWeek === "*" || parsed.dayOfWeek === "?"
  const dayOfMonthMatches = validDaysOfMonth.includes(date.getDate())
  const dayOfWeekMatches = validDaysOfWeek.includes(date.getDay())

  if (!dayOfMonthWildcard && !dayOfWeekWildcard) {
    return dayOfMonthMatches && dayOfWeekMatches
  }
  if (!dayOfMonthWildcard) return dayOfMonthMatches
  if (!dayOfWeekWildcard) return dayOfWeekMatches
  return true
}

function nextGreater(values: number[], current: number): number | undefined {
  return values.find((value) => value > current)
}

function startOfDayAfter(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1, 0, 0, 0, 0)
}

export function getNextExecutionTimes(
  cronExpression: string,
  includeSeconds = false,
  count = 5,
  startDate = new Date(),
): Date[] {
  const parsed = parseCronExpression(cronExpression, includeSeconds)
  if (!parsed || count <= 0) return []

  const validSeconds = includeSeconds ? expandCronField(parsed.seconds, 0, 59) : [0]
  const validMinutes = expandCronField(parsed.minutes, 0, 59)
  const validHours = expandCronField(parsed.hours, 0, 23)
  const validDaysOfMonth = expandCronField(parsed.dayOfMonth, 1, 31)
  const validMonths = expandCronField(parsed.month, 1, 12)
  const validDaysOfWeek = expandDayOfWeek(parsed.dayOfWeek)
  const validYears = parsed.year ? expandCronField(parsed.year, 1970, 2199) : null

  if (
    validSeconds.length === 0 ||
    validMinutes.length === 0 ||
    validHours.length === 0 ||
    validDaysOfMonth.length === 0 ||
    validMonths.length === 0 ||
    validDaysOfWeek.length === 0 ||
    (validYears && validYears.length === 0)
  ) {
    return []
  }

  let current = new Date(startDate)
  current.setMilliseconds(0)
  if (includeSeconds) {
    current.setSeconds(current.getSeconds() + 1)
  } else {
    current.setSeconds(0)
    current.setMinutes(current.getMinutes() + 1)
  }

  const deadline = new Date(startDate)
  deadline.setFullYear(deadline.getFullYear() + 100)
  const results: Date[] = []

  while (results.length < count && current <= deadline) {
    if (validYears && !validYears.includes(current.getFullYear())) {
      const nextYear = nextGreater(validYears, current.getFullYear())
      if (nextYear === undefined) break
      current = new Date(nextYear, 0, 1, 0, 0, 0, 0)
      continue
    }

    const month = current.getMonth() + 1
    if (!validMonths.includes(month)) {
      const nextMonth = nextGreater(validMonths, month)
      current = nextMonth === undefined
        ? new Date(current.getFullYear() + 1, validMonths[0] - 1, 1, 0, 0, 0, 0)
        : new Date(current.getFullYear(), nextMonth - 1, 1, 0, 0, 0, 0)
      continue
    }

    if (!dayMatches(current, parsed, validDaysOfMonth, validDaysOfWeek)) {
      current = startOfDayAfter(current)
      continue
    }

    if (!validHours.includes(current.getHours())) {
      const nextHour = nextGreater(validHours, current.getHours())
      if (nextHour === undefined) {
        current = startOfDayAfter(current)
      } else {
        current.setHours(nextHour, 0, 0, 0)
      }
      continue
    }

    if (!validMinutes.includes(current.getMinutes())) {
      const nextMinute = nextGreater(validMinutes, current.getMinutes())
      if (nextMinute === undefined) {
        current.setHours(current.getHours() + 1, 0, 0, 0)
      } else {
        current.setMinutes(nextMinute, 0, 0)
      }
      continue
    }

    if (!validSeconds.includes(current.getSeconds())) {
      const nextSecond = nextGreater(validSeconds, current.getSeconds())
      if (nextSecond === undefined) {
        current.setMinutes(current.getMinutes() + 1, 0, 0)
      } else {
        current.setSeconds(nextSecond, 0)
      }
      continue
    }

    results.push(new Date(current))
    if (includeSeconds) {
      current.setSeconds(current.getSeconds() + 1)
    } else {
      current.setMinutes(current.getMinutes() + 1)
      current.setSeconds(0, 0)
    }
  }

  return results
}

function describeSelection(field: string, label: (value: number) => string, unit: string): string {
  if (field.startsWith("*/")) return `每${field.slice(2)}${unit}`

  const rangeStepMatch = field.match(/^(\d+)-(\d+)\/(\d+)$/)
  if (rangeStepMatch) {
    return `${label(Number(rangeStepMatch[1]))}到${label(Number(rangeStepMatch[2]))}之间每${rangeStepMatch[3]}${unit}`
  }

  const rangeMatch = field.match(/^(\d+)-(\d+)$/)
  if (rangeMatch) return `${label(Number(rangeMatch[1]))}到${label(Number(rangeMatch[2]))}`

  if (field.includes(",")) {
    return field.split(",").map((value) => label(Number.parseInt(value, 10))).join("、")
  }

  return label(Number.parseInt(field, 10))
}

export function generateCronDescription(
  expression: string,
  includeSeconds = false,
  _translate?: unknown,
): string {
  const commonExpressions: Record<string, string> = {
    "* * * * *": "每分钟执行",
    "0 * * * *": "每小时执行（整点）",
    "0 0 * * *": "每天凌晨执行",
    "0 0 * * 1-5": "每工作日凌晨执行",
    "0 0 1 * *": "每月1号凌晨执行",
    "*/5 * * * *": "每5分钟执行",
    "0 */2 * * *": "每2小时执行",
    "0 0 * * 0": "每周日凌晨执行",
    "0 9 * * 1-5": "工作日上午9点执行",
  }
  if (!includeSeconds && commonExpressions[expression]) return commonExpressions[expression]

  const parsed = parseCronExpression(expression, includeSeconds)
  if (!parsed) return "无效的表达式"

  const parts: string[] = []
  if (includeSeconds) {
    if (parsed.seconds === "*") {
      parts.push("每秒")
    } else {
      parts.push(describeSelection(parsed.seconds, (value) => `在第${value}秒`, "秒"))
    }
  }

  if (!(includeSeconds && parsed.seconds === "*" && parsed.minutes === "*")) {
    if (parsed.minutes === "*") {
      parts.push("每分钟")
    } else {
      parts.push(describeSelection(parsed.minutes, (value) => `第${value}分钟`, "分钟").replace(/^第/, "在第"))
    }
  }

  if (parsed.hours !== "*") {
    parts.push(`在${describeSelection(parsed.hours, (value) => `${value}点`, "小时")}`)
  }
  if (parsed.dayOfMonth !== "*" && parsed.dayOfMonth !== "?") {
    parts.push(`在${describeSelection(parsed.dayOfMonth, (value) => `${value}号`, "天")}`)
  }
  if (parsed.month !== "*") {
    parts.push(`在${describeSelection(parsed.month, (value) => `${value}月`, "个月")}`)
  }

  if (parsed.dayOfWeek !== "*" && parsed.dayOfWeek !== "?") {
    const dayNames = ["周日", "周一", "周二", "周三", "周四", "周五", "周六", "周日"]
    if (parsed.dayOfWeek === "1-5") {
      parts.push("在工作日")
    } else {
      parts.push(`在${describeSelection(parsed.dayOfWeek, (value) => dayNames[value] ?? `周${value}`, "天")}`)
    }
  }

  if (parsed.year && parsed.year !== "*") {
    parts.push(`在${describeSelection(parsed.year, (value) => `${value}年`, "年")}`)
  }

  return `${parts.join("，")}执行`
}
