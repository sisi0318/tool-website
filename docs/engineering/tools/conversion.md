---
description: 格式转换工具实现 - 温度、汇率、Docker、Crontab 转换的核心逻辑和使用方式
type: Permanent
---

# 格式转换工具实现

## 工具列表

| 工具 | 目录 | 核心依赖 |
|------|------|----------|
| 温度转换 | `app/tools/temperature-converter/` | 自定义公式 |
| 汇率转换 | `app/tools/currency/` | Server Action + ExchangeRate-API |
| Docker 转换 | `app/tools/docker-converter/` | 自定义解析器 |
| Crontab 生成 | `app/tools/crontab/` | 自定义算法 |

## 温度转换 (`temperature-converter/`)

### 核心逻辑

纯客户端实现，基于物理公式的温度标度互转。

**支持的标度**（8 种）：

| 标度 | 符号 | 公式基准 |
|------|------|----------|
| 摄氏度 | °C | 水的冰点 = 0°C，沸点 = 100°C |
| 华氏度 | °F | °F = °C × 9/5 + 32 |
| 开尔文 | K | K = °C + 273.15 |
| 兰金温标 | °R | °R = °C × 9/5 + 491.67 |
| 德利尔 | °De | °De = (100 - °C) × 3/2 |
| 牛顿 | °N | °N = °C × 33/100 |
| 列氏度 | °Ré | °Ré = °C × 4/5 |
| 罗氏温标 | °Rø | °Rø = °C × 21/40 + 7.5 |

**转换实现**：
```
所有标度 → 摄氏度 → 其他标度
```

### 输入交互

- 数字输入框，支持小数和负数
- 支持 "inf" / "-inf" / "nan" 处理
- 实时双向同步（编辑任一字段，其他自动更新）

## 汇率转换 (`currency/`)

### 核心逻辑

使用 Server Action 调用外部汇率 API，结合内存缓存。

**API**：`ExchangeRate-API` (https://api.exchangerate-api.com/v4/latest/{base})

**Server Action** (`app/tools/currency/actions.ts`)：
```typescript
async function getAllExchangeRates(base: string): Promise<ExchangeRates>
```

**缓存策略**：
- 内存缓存（8 小时 TTL）
- 避免频繁调用 API
- 支持强制刷新

**汇率列表**：USD, EUR, GBP, JPY, CNY, KRW, HKD, TWD, SGD, AUD, CAD, CHF, INR, MXN, BRL 等 30+ 货币

**交互**：
1. 选择基准货币（默认 USD）
2. 输入金额（支持多币种同时输入换算）
3. 查看所有货币的转换结果
4. 切换基准货币时重新计算

## Docker 转换 (`docker-converter/`)

### 核心逻辑

自定义解析器实现 `docker run` 命令与 `docker-compose.yml` 双向转换。

**解析 `docker run` 命令**：
```bash
docker run -d --name web -p 8080:80 -e ENV=prod nginx:alpine
```

解析步骤：
1. Tokenize：按空格分割，处理引号转义
2. 识别选项：`--name`, `-p`, `-e`, `-v`, `--env-file` 等
3. 提取镜像名和命令参数
4. 构建 YAML 结构

**输出 `docker-compose.yml`**：
```yaml
version: '3.8'
services:
  web:
    image: nginx:alpine
    container_name: web
    ports:
      - "8080:80"
    environment:
      - ENV=prod
    restart: unless-stopped
```

**支持的选项**：

| docker run | docker-compose |
|------------|----------------|
| `--name` | `container_name` |
| `-p host:container` | `ports` |
| `-e KEY=value` | `environment` |
| `--env-file` | `env_file` |
| `-v host:container:ro` | `volumes` (ro) |
| `--network` | `networks` |
| `--restart` | `restart` |
| `-d` | `detach` |
| `--rm` | 无对应（临时容器） |
| `-it` | 无对应（交互容器） |

**限制**：
- 不支持多容器 `docker run`（每次只处理一个）
- 复杂 entrypoint/cmd 可能无法完美转换

## Crontab 生成 (`crontab/`)

### 核心逻辑

自定义 cron 表达式解析和可视化生成。

**Crontab 格式**：
```
┌───────────── 分钟 (0-59)
│ ┌───────────── 小时 (0-23)
│ │ ┌───────────── 日 (1-31)
│ │ │ ┌───────────── 月 (1-12)
│ │ │ │ ┌───────────── 星期 (0-6, 0=周日)
│ │ │ │ │
* * * * *
```

**表达式验证**：
- 解析 5 个字段
- 支持特殊字符：`*`, `,`, `-`, `/`, `L`, `W`, `#`
- 范围检查（分钟 0-59，时 0-23 等）

**可视化时间线**：
```
        0    10    20    30    40    50
  00  ************
  01  *
  02  *
  ...
```

每月/每周/工作日的图形化展示。

**下次执行时间**：
```typescript
function getNextExecutions(cron: string, count: number): Date[]
```
- 使用 `cron-parser` 或自实现
- 计算接下来 N 次执行时间

**预设模板**：
- 每分钟
- 每小时
- 每天午夜
- 每周一
- 每月 1 日
- 工作日 9:00

### 使用场景

- 定时备份脚本
- 监控任务调度
- 清理作业配置

## 相关文档

- [[02-frontend-architecture]]
- [[03-tool-system]]