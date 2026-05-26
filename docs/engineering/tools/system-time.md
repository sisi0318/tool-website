---
description: 系统与时间工具实现 - Time、UUID、BMI 的核心逻辑和使用方式
type: Permanent
---

# 系统与时间工具实现

## 工具列表

| 工具 | 目录 | 核心依赖 |
|------|------|----------|
| 时间工具 | `app/tools/time/` | `Intl.DateTimeFormat`, 浏览器定时器 |
| UUID 生成 | `app/tools/uuid/` | 自定义算法 (`Math.random`) |
| BMI 计算 | `app/tools/bmi/` | BMI 公式 |

## 时间工具 (`time/`)

### 核心逻辑

基于 `Intl.DateTimeFormat` 的时间显示和转换，5 个子工具。

**子工具 1：当前时间**
```typescript
const formatter = new Intl.DateTimeFormat('zh-CN', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false
})
setInterval(() => {
  timeDisplay.textContent = formatter.format(new Date())
}, 1000)
```

**子工具 2：世界时钟**
- 预设 13 个时区（UTC, 北京, 东京, 纽约, 伦敦, 悉尼等）
- 可添加/移除时区
- 本地时间和目标时间同时显示
- 夏令时自动处理

**子工具 3：秒表**
```typescript
let startTime: number
let elapsed = 0
let laps: number[] = []

function start() {
  startTime = performance.now() - elapsed
  requestAnimationFrame(tick)
}

function lap() {
  laps.push(elapsed)
}

function tick() {
  elapsed = performance.now() - startTime
  // 更新显示
  requestAnimationFrame(tick)
}
```
- 10ms 精度（`performance.now()`）
- 计次功能（记录各圈耗时）
- 暂停/重置

**子工具 4：倒计时**
- 预设时间：1/5/10/15/30 分钟, 1 小时
- 自定义时间输入
- 倒计时结束提示（声音 + 弹窗）
- 可暂停/继续

**子工具 5：时间戳转换**
```typescript
// 时间戳 → 日期
new Date(timestamp * 1000).toISOString()

// 日期 → 时间戳
Math.floor(date.getTime() / 1000)

// 当前时间戳
Date.now()
```
- Unix 时间戳（秒/毫秒）互转
- UTC / 本地时区转换
- 支持毫秒精度

**设置持久化**：localStorage 保存
- 世界时钟列表
- 时间/日期格式（12h/24h）
- 是否显示秒

## UUID 生成 (`uuid/`)

### 核心逻辑

使用 `Math.random()` 自定义实现 UUID v4 和 v1 变种。

**UUID v4 生成**：
```typescript
function uuidV4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}
```

- `x`: 随机十六进制 [0-f]
- `y`: 随机十六进制，但最高位必须是 8/9/a/b（对应 variant 10xx）
- 符合 RFC 4122 规范

**UUID v1（类）生成**：
```typescript
function uuidV1Like(): string {
  const now = Date.now()
  const clock = Math.floor(Math.random() * 0x4000)
  const node = // 随机 6 字节
  return format([
    timeLow,
    timeMid,
    timeHighAndVersion,
    clockSeqHiAndReserved,
    clockSeqLow,
    node
  ])
}
```
- 基于时间戳 + 时钟序列 + 随机节点
- 不完全符合 RFC 4122（简化实现）

**Nil UUID**：`00000000-0000-0000-0000-000000000000`

**格式选项**：
| 选项 | 效果 |
|------|------|
| 大写 | ABCDEF... |
| 连字符 | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |
| 花括号 | `{xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx}` |
| 引号 | `"xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"` |
| 无连字符 | `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |

**批量生成**：1-100 个

## BMI 计算 (`bmi/`)

### 核心逻辑

纯数学公式，无外部依赖。

**公式**：

| 单位制 | 公式 |
|--------|------|
| 公制 | `BMI = weight(kg) / height(m)²` |
| 英制 | `BMI = (weight(lbs) * 703) / height(in)²` |

**分类**：

| BMI 范围 | 分类 |
|----------|------|
| < 18.5 | 过轻 |
| 18.5 - 24.9 | 正常 |
| 25 - 29.9 | 超重 |
| 30 - 34.9 | 肥胖 I |
| 35 - 39.9 | 肥胖 II |
| ≥ 40 | 肥胖 III |

**实现**：
```typescript
function calculateBMI(weight: number, height: number, unit: 'metric' | 'imperial'): number {
  if (unit === 'metric') {
    return weight / (height / 100) ** 2
  } else {
    return (weight * 703) / (height ** 2)
  }
}
```

**UI**：
- 切换公制/英制
- 身高/体重输入（滑块 + 数字输入）
- 实时 BMI 计算
- 可视化刻度（渐变色 + 指针指示位置）
- 分类高亮

**注意**：BMI 不考虑肌肉量、年龄、性别等因素，仅作为粗略参考。

## 相关文档

- [[01-design-system]]
- [[07-performance]]