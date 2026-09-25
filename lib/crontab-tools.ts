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

const CRON_FIELD_RANGES = {
  seconds: [0, 59],
  minutes: [0, 59],
  hours: [0, 23],
  dayOfMonth: [1, 31],
  month: [1, 12],
  dayOfWeek: [0, 7],
  year: [1970, 2199],
} as const

function isValidCronField(value: string, field: keyof typeof CRON_FIELD_RANGES): boolean {
  // "?" 只在日、星期两个字段里有意义(Quartz / AWS 的"不指定")
  if (value === "?") return field === "dayOfMonth" || field === "dayOfWeek"
  const [min, max] = CRON_FIELD_RANGES[field]
  return expandCronField(value, min, max).length > 0
}

function isValidCronLayout(parts: string[], includeSeconds: boolean): boolean {
  const layout: Array<keyof typeof CRON_FIELD_RANGES> = includeSeconds
    ? ["seconds", "minutes", "hours", "dayOfMonth", "month", "dayOfWeek", "year"]
    : ["minutes", "hours", "dayOfMonth", "month", "dayOfWeek", "year"]
  const required = layout.length - 1
  if (parts.length !== required && parts.length !== required + 1) return false
  return parts.every((part, index) => isValidCronField(part, layout[index]))
}

/**
 * 判断一段表达式是否带秒字段,返回应当使用的 includeSeconds。
 *
 * 6 段表达式有两种读法:Quartz / Spring 的「秒 + 5 段」,和 AWS 等的「5 段 + 年」。
 * 此前在默认的 5 段模式下一律按后者解析,`0 0 9 * * ?` 被算成「每月 9 日 00:00」而不给任何提示。
 * 只有按「秒」读得通、且按「年」读不通或年份位只是 * / ? 时才认为带秒;
 * 含秒模式下粘贴标准 5 段表达式则切回标准模式。其余情况维持当前模式。
 */
export function inferCronIncludeSeconds(expression: string, includeSeconds: boolean): boolean {
  const parts = expression.trim().split(/\s+/).filter(Boolean)
  if (includeSeconds) {
    return !(parts.length === 5 && isValidCronLayout(parts, false))
  }
  if (parts.length === 7) return isValidCronLayout(parts, true)
  if (parts.length !== 6 || !isValidCronLayout(parts, true)) return false
  return !isValidCronLayout(parts, false) || parts[5] === "*" || parts[5] === "?"
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
    // Traditional Vixie/POSIX cron treats these two restricted fields as OR.
    return dayOfMonthMatches || dayOfWeekMatches
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

type CronTranslator = (key: string) => string

const defaultCronText: Record<string, string> = {
  cronCommonEveryMinute: "每分钟执行",
  cronCommonEveryHour: "每小时执行（整点）",
  cronCommonEveryDay: "每天凌晨执行",
  cronCommonEveryWeekday: "每工作日凌晨执行",
  cronCommonFirstDay: "每月1号凌晨执行",
  cronCommonEvery5Minutes: "每5分钟执行",
  cronCommonEvery2Hours: "每2小时执行",
  cronCommonSunday: "每周日凌晨执行",
  cronCommonWeekday9: "工作日上午9点执行",
  cronInvalid: "无效的表达式",
  cronEvery: "每{{step}}{{unit}}",
  cronRangeEvery: "{{start}}到{{end}}之间每{{step}}{{unit}}",
  cronRange: "{{start}}到{{end}}",
  cronListSeparator: "、",
  cronPartSeparator: "，",
  cronEverySecond: "每秒",
  cronEveryMinute: "每分钟",
  cronAt: "在{{value}}",
  cronOn: "在{{value}}",
  cronIn: "在{{value}}",
  cronWeekdays: "工作日",
  cronSecondLabel: "第{{value}}秒",
  cronMinuteLabel: "第{{value}}分钟",
  cronHourLabel: "{{value}}点",
  cronDayLabel: "{{value}}号",
  cronMonthLabel: "{{value}}月",
  cronYearLabel: "{{value}}年",
  cronSunday: "周日",
  cronMonday: "周一",
  cronTuesday: "周二",
  cronWednesday: "周三",
  cronThursday: "周四",
  cronFriday: "周五",
  cronSaturday: "周六",
  cronSecondsUnit: "秒",
  cronMinutesUnit: "分钟",
  cronHoursUnit: "小时",
  cronDaysUnit: "天",
  cronMonthsUnit: "个月",
  cronYearsUnit: "年",
  cronDescriptionResult: "{{parts}}执行",
}

function translateCron(
  key: string,
  translate?: CronTranslator,
  values: Record<string, string | number> = {},
): string {
  const template = translate ? translate(key) : defaultCronText[key] ?? key
  return Object.entries(values).reduce(
    (message, [name, value]) => message.replaceAll(`{{${name}}}`, String(value)),
    template,
  )
}

function describeSelection(
  field: string,
  label: (value: number) => string,
  unitKey: string,
  translate?: CronTranslator,
): string {
  if (field.startsWith("*/")) {
    return translateCron("cronEvery", translate, {
      step: field.slice(2),
      unit: translateCron(unitKey, translate),
    })
  }

  const rangeStepMatch = field.match(/^(\d+)-(\d+)\/(\d+)$/)
  if (rangeStepMatch) {
    return translateCron("cronRangeEvery", translate, {
      start: label(Number(rangeStepMatch[1])),
      end: label(Number(rangeStepMatch[2])),
      step: rangeStepMatch[3],
      unit: translateCron(unitKey, translate),
    })
  }

  const rangeMatch = field.match(/^(\d+)-(\d+)$/)
  if (rangeMatch) {
    return translateCron("cronRange", translate, {
      start: label(Number(rangeMatch[1])),
      end: label(Number(rangeMatch[2])),
    })
  }

  if (field.includes(",")) {
    return field
      .split(",")
      .map((value) => label(Number.parseInt(value, 10)))
      .join(translateCron("cronListSeparator", translate))
  }

  return label(Number.parseInt(field, 10))
}

export function generateCronDescription(
  expression: string,
  includeSeconds = false,
  translate?: CronTranslator,
): string {
  const commonExpressions: Record<string, string> = {
    "* * * * *": "cronCommonEveryMinute",
    "0 * * * *": "cronCommonEveryHour",
    "0 0 * * *": "cronCommonEveryDay",
    "0 0 * * 1-5": "cronCommonEveryWeekday",
    "0 0 1 * *": "cronCommonFirstDay",
    "*/5 * * * *": "cronCommonEvery5Minutes",
    "0 */2 * * *": "cronCommonEvery2Hours",
    "0 0 * * 0": "cronCommonSunday",
    "0 9 * * 1-5": "cronCommonWeekday9",
  }
  if (!includeSeconds && commonExpressions[expression]) {
    return translateCron(commonExpressions[expression], translate)
  }

  const parsed = parseCronExpression(expression, includeSeconds)
  if (!parsed) return translateCron("cronInvalid", translate)

  const parts: string[] = []
  const withContext = (field: string, contextKey: "cronAt" | "cronOn" | "cronIn", selection: string) =>
    field.includes("/")
      ? selection
      : translateCron(contextKey, translate, { value: selection })

  if (includeSeconds) {
    if (parsed.seconds === "*") {
      parts.push(translateCron("cronEverySecond", translate))
    } else {
      const selection = describeSelection(
        parsed.seconds,
        (value) => translateCron("cronSecondLabel", translate, { value }),
        "cronSecondsUnit",
        translate,
      )
      parts.push(withContext(parsed.seconds, "cronAt", selection))
    }
  }

  if (!(includeSeconds && parsed.seconds === "*" && parsed.minutes === "*")) {
    if (parsed.minutes === "*") {
      parts.push(translateCron("cronEveryMinute", translate))
    } else {
      const selection = describeSelection(
        parsed.minutes,
        (value) => translateCron("cronMinuteLabel", translate, { value }),
        "cronMinutesUnit",
        translate,
      )
      parts.push(withContext(parsed.minutes, "cronAt", selection))
    }
  }

  if (parsed.hours !== "*") {
    const selection = describeSelection(
      parsed.hours,
      (value) => translateCron("cronHourLabel", translate, { value }),
      "cronHoursUnit",
      translate,
    )
    parts.push(withContext(parsed.hours, "cronAt", selection))
  }
  if (parsed.dayOfMonth !== "*" && parsed.dayOfMonth !== "?") {
    const selection = describeSelection(
      parsed.dayOfMonth,
      (value) => translateCron("cronDayLabel", translate, { value }),
      "cronDaysUnit",
      translate,
    )
    parts.push(withContext(parsed.dayOfMonth, "cronOn", selection))
  }
  if (parsed.month !== "*") {
    const selection = describeSelection(
      parsed.month,
      (value) => translateCron("cronMonthLabel", translate, { value }),
      "cronMonthsUnit",
      translate,
    )
    parts.push(withContext(parsed.month, "cronIn", selection))
  }

  if (parsed.dayOfWeek !== "*" && parsed.dayOfWeek !== "?") {
    const dayNameKeys = [
      "cronSunday",
      "cronMonday",
      "cronTuesday",
      "cronWednesday",
      "cronThursday",
      "cronFriday",
      "cronSaturday",
      "cronSunday",
    ]
    if (parsed.dayOfWeek === "1-5") {
      parts.push(translateCron("cronOn", translate, { value: translateCron("cronWeekdays", translate) }))
    } else {
      const selection = describeSelection(
        parsed.dayOfWeek,
        (value) => translateCron(dayNameKeys[value] ?? "cronSunday", translate),
        "cronDaysUnit",
        translate,
      )
      parts.push(withContext(parsed.dayOfWeek, "cronOn", selection))
    }
  }

  if (parsed.year && parsed.year !== "*") {
    const selection = describeSelection(
      parsed.year,
      (value) => translateCron("cronYearLabel", translate, { value }),
      "cronYearsUnit",
      translate,
    )
    parts.push(withContext(parsed.year, "cronIn", selection))
  }

  return translateCron("cronDescriptionResult", translate, {
    parts: parts.join(translateCron("cronPartSeparator", translate)),
  })
}
