---
description: 编码与数据工具实现 - Encoding、JSON、Protobuf、Base Converter、Case Converter 的核心逻辑和使用方式
type: Permanent
---

# 编码与数据工具实现

## 工具列表

| 工具 | 目录 | 核心依赖 |
|------|------|----------|
| 编码解码 | `app/tools/encoding/` | 自定义映射 |
| JSON 工具 | `app/tools/json/` | 自定义解析 + `js-yaml` |
| Protobuf 解析 | `app/tools/protobuf/` | `protobufjs` |
| 进制转换 | `app/tools/base-converter/` | 自定义算法 |
| 大小写转换 | `app/tools/case-converter/` | 自定义逻辑 |

## 编码解码 (`encoding/`)

### 核心逻辑

纯客户端实现，支持多种编码格式的双向转换。

**支持的编码**：

| 编码 | 方向 | 说明 |
|------|------|------|
| Base64 | 编码/解码 | 标准 Base64 + URL-safe 变种 |
| URL 编码 | 编码/解码 | encodeURIComponent / decodeURIComponent |
| HTML 实体 | 编码/解码 | 命名实体（&nbsp; 等）和数字实体（&#x...） |
| Unicode | 编码/解码 | `\uXXXX` 格式 |
| Punycode | 编码/解码 | 国际化域名转换 |
| MIME encoded-word | 编码/解码 | `=?UTF-8?B?...?=` 格式 |

**特性**：
- 多行模式：支持处理多行文本，每行独立编解码
- 实时预览：输入即输出
- 批量操作：可一次处理多种编码的连续转换

### 典型使用场景

1. URL 参数编码：`key=value&foo=bar` → `key%3Dvalue%26foo%3Dbar`
2. 隐藏文本：`Hello` → `\u0048\u0065\u006C\u006C\u006F`
3. 域名国际化：`中国.cn` → `xn--fiqs8s.cn`

## JSON 工具 (`json/`)

### 核心逻辑

围绕 JSON 的全方位处理，使用自定义解析器 + `js-yaml` 处理 YAML。

**功能列表**：

| 功能 | 说明 |
|------|------|
| 格式化 | 2 空格/4 空格/Tab 缩进，可折叠 |
| 压缩 | 移除空格和换行 |
| 校验 | JSON.parse 验证，有效/无效提示 |
| JSONPath 查询 | 语法 `$.store.book[*].author` |
| JSON ↔ YAML | `js-yaml` 库双向转换 |
| Unicode ↔ 中文 | `\u4e2d\u6587` ↔ `中文` |
| 转义/反转义 | 特殊字符（双引号、换行等）转义 |
| JSON 树查看 | 可折叠树形结构，带复制功能 |

**JSONPath 实现**：
- 手动实现 JSONPath 语法解析器
- 支持 `$.`, `..`, `[*]`, `[?]` 等语法
- 结果高亮显示

**树形查看器组件** (`components/json-tree-view.tsx`)：
- 递归渲染 JSON 对象/数组
- 节点类型图标（string/number/boolean/null/object/array）
- 单节点折叠/展开
- 复制节点值或路径

### 性能优化

- 大 JSON 文件使用虚拟滚动
- 格式化和压缩延迟执行，避免 UI 卡顿

## Protobuf 解析 (`protobuf/`)

### 核心逻辑

使用 `protobufjs` 库，支持无 Schema 解析和基于 .proto 文件的编解码。

**两种模式**：

1. **Schemaless 模式**（默认）
   - 自动检测字段类型（varint、fixed64、delimited、fixed32）
   - 将数据解析为 `{tag: number, wireType: number, value: any}` 结构
   - 用户需要自行理解 protobuf wire format

2. **Schema 模式**
   - 加载 .proto 文件
   - 解析 Message 定义
   - 根据 schema 解析为结构化对象

**输入格式**：
- Hex 字符串（如 `0a 06 12 04 74 65 73 74`）
- Base64 字符串
- 原始字节数组

### protobuf wire format 要点

- Tag = (field_number << 3) | wire_type
- Wire type 0: Varint, 1: 64-bit, 2: Length-delimited, 5: 32-bit

## 进制转换 (`base-converter/`)

### 核心逻辑

自定义算法，支持从 2 进制到 36 进制的任意进制转换。

**支持的进制**：2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36

**数字表示**：
- 10 进制：0-9
- 11-36 进制：a-z（忽略大小写）

**输入验证**：
- 自动检测非法字符（如二进制输入 `2` 会被拒绝）
- 支持带符号整数
- 支持小数（部分进制）

### 精度问题

JavaScript 的 `number` 类型在超过 `Number.MAX_SAFE_INTEGER` (2^53-1) 时会丢失精度。大数运算使用字符串模拟精确计算。

## 大小写转换 (`case-converter/`)

### 核心逻辑

纯字符串处理，无外部依赖。

**支持的格式**（12+ 种）：

| 格式 | 示例 |
|------|------|
| 全大写 | HELLO WORLD |
| 全小写 | hello world |
| 首字母大写 | Hello World |
| 句子大写 | hello world. |
| camelCase | helloWorld |
| PascalCase | HelloWorld |
| snake_case | hello_world |
| SCREAMING_SNAKE | HELLO_WORLD |
| kebab-case | hello-world |
| COBOL-CASE | HELLO-WORLD |
| lower-hyphen | hello-world |
| Title Case | Hello World |
| dot.case | hello.world |
| path/case | hello/world |
| Train-Case | Hello-World |

### 实现要点

- 使用正则表达式识别单词边界
- 保留原有空格和标点
- 中文字符不进行大小写转换（返回原样）

## 相关文档

- [[01-design-system]]
- [[03-tool-system]]