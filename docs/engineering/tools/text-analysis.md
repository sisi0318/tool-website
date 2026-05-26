---
description: 文本分析工具实现 - 文本统计、正则测试、文本对比的核心逻辑和使用方式
type: Permanent
---

# 文本分析工具实现

## 工具列表

| 工具 | 目录 | 核心依赖 |
|------|------|----------|
| 文本统计 | `app/tools/text-stats/` | JavaScript Regex |
| 正则测试 | `app/tools/regex/` | JavaScript RegExp |
| 文本对比 | `app/tools/diff/` | 自定义 LCS 算法 |

## 文本统计 (`text-stats/`)

### 核心逻辑

纯客户端文本分析，使用正则表达式和字符串方法。

**统计维度**：

| 维度 | 计算方式 |
|------|----------|
| 字符数 | `str.length`（含空格） |
| 字符数（无空格） | 移除空格后的长度 |
| 单词数 | 空格/标点分割的 token 数量 |
| 句子数 | 以 `.!？` 等结尾的句子数量 |
| 段落数 | 连续换行分割的段落数量 |
| 行数 | 换行符数量 + 1 |
| 中文字数 | Unicode 范围 `\u4e00-\u9fff` |
| 英文字数 | ASCII 字母数量 |
| 数字个数 | 数字字符数量 |

**阅读时间估算**：
- 中文：200 字/分钟
- 英文：200 词/分钟
- 混合取加权平均

**词频统计**：
```typescript
function getWordFrequency(text: string): Map<string, number>
```
- 中英文分别统计
- 排除停用词（可选）
- 按频率降序排列

**输出格式**：
```
字符数：1,234
单词数：456
句子数：28
段落数：5

阅读时间：约 3 分钟

词频 TOP 10：
1. "Hello" - 12 次
2. "World" - 8 次
...
```

## 正则测试 (`regex/`)

### 核心逻辑

使用 JavaScript 内置 `RegExp` 对象，支持实时匹配和替换。

**主要功能**：

1. **实时匹配**
   ```typescript
   const regex = new RegExp(pattern, flags)
   const matches = text.matchAll(regex)
   ```

2. **匹配高亮**
   - 遍历所有匹配
   - 用 `<mark>` 包裹并添加样式
   - 支持分组捕获高亮

3. **替换功能**
   ```typescript
   const result = text.replace(regex, replacement)
   ```
   - 支持 `$1`, `$2` 等反向引用
   - 支持 `(?<name>...)` 命名分组

4. **语法参考**
   - 内置速查表（字符类、量词、锚点等）
   - 常见正则示例（邮箱、手机号、URL 等）

**Flags 支持**：
- `g` - 全局匹配
- `i` - 忽略大小写
- `m` - 多行模式
- `s` - dotall 模式
- `u` - Unicode 模式

**错误处理**：
```typescript
try {
  new RegExp(pattern, flags)
} catch (e) {
  // 显示语法错误信息
}
```

**性能考虑**：
- 防抖处理（300ms）
- 避免灾难性回溯（大量重复的贪心/惰性组合）

## 文本对比 (`diff/`)

### 核心逻辑

实现两种 diff 算法：简单 LCS 和 Myers 算法。

**算法 1：简单 Diff（基于行）**
```typescript
function simpleDiff(oldText: string, newText: string): DiffResult
```
- 按行分割文本
- 逐行比较 LCS（最长公共子序列）
- 标记 Added / Removed / Unchanged

**算法 2：Myers Diff（动态规划）**
```typescript
function myersDiff(oldText: string, newText: string): DiffResult
```
- 经典的 Myers 算法
- 求最短编辑脚本（Shortest Edit Script）
- 逐字符比较（可用于行内差异）

**Diff 结果结构**：
```typescript
interface DiffItem {
  type: 'added' | 'removed' | 'unchanged'
  value: string
  lineNumber?: number  // 可选，用于行号展示
}
```

**输出示例**：
```
- 第一行被删除
+ 新增一行
  未修改行
```

**颜色约定**：
- 绿色背景：新增
- 红色背景：删除
- 无背景：未修改

**使用场景**：
- 代码 diff
- 文档版本对比
- 翻译文本对照

## 相关文档

- [[03-tool-system]]
- [[07-performance]]