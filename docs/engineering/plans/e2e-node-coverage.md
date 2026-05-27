# E2E 测试计划 - 全节点覆盖

## 1. 测试范围

### 1.1 测试目标

为所有 39 个节点类型添加 E2E 测试，覆盖两个维度：

| 维度 | 说明 |
|------|------|
| **端口数量** | 验证渲染的 input/output handle 数量与 adapter 定义一致 |
| **功能验证** | 通过基础节点 → 工具节点 → 基础节点 的链路，验证工具能正确处理数据 |

### 1.2 节点分类

根据可测试性将节点分为 4 组：

| 分组 | 说明 | 测试策略 |
|------|------|----------|
| **A: 确定性输出** | 输出可精确断言 | 用 store 创建链路 → executeAll → 检查 output |
| **B: 格式可验证** | 输出格式可验证但值不确定 | executeAll → 检查 output 存在且类型正确 |
| **C: 需要文件输入** | 需要 bytes 类型输入 | 仅验证端口数量（功能测试需文件上传，不在本次范围） |
| **D: 无输入源节点** | 无 input，自身产生数据 | 直接 execute → 检查 output |

---

## 2. 端口数量测试

### 2.1 测试方案

对每个节点类型：
1. 通过 store 创建节点
2. 等待节点渲染
3. 统计 `.react-flow__handle[data-handlepos='left']` 数量 = input 端口数
4. 统计 `.react-flow__handle[data-handlepos='right']` 数量 = output 端口数
5. 与 adapter 定义的 `inputs.length` / `outputs.length` 断言

### 2.2 端口定义表

| 节点类型 | inputs | outputs | input IDs | output IDs |
|----------|--------|---------|-----------|------------|
| string | 1 | 1 | input | value |
| number | 1 | 1 | input | value |
| json | 1 | 1 | input | value |
| file | 1 | 1 | input | content |
| hash | 1 | 2 | data | hash, algorithm |
| hmac | 2 | 1 | data, key | hmac |
| crypto | 2 | 1 | data, key | result |
| encoding | 2 | 1 | input, mode | output |
| classic-cipher | 1 | 1 | data | result |
| jwt | 1 | 3 | token | header, payload, signature |
| json-format | 1 | 2 | data | formatted, minified |
| protobuf | 1 | 1 | data | decoded |
| jce | 1 | 1 | data | decoded |
| image-to-base64 | 1 | 2 | file | base64, dataUri |
| exif-viewer | 1 | 1 | file | exif |
| image-compress | 1 | 2 | file | file, info |
| image-editor | 1 | 1 | file | file |
| qrcode | 1 | 2 | data | image, dataUri |
| qrcode-decode | 1 | 1 | file | data |
| meme-splitter | 1 | 1 | file | parts |
| image-coordinates | 1 | 1 | file | coordinates |
| text-stats | 1 | 1 | text | stats |
| case-converter | 1 | 6 | text | upper, lower, title, camel, snake, kebab |
| regex | 1 | 2 | text | matches, test |
| diff | 2 | 1 | text1, text2 | diff |
| http-tester | 2 | 2 | url, body | response, status |
| crontab | 1 | 2 | expression | parsed, nextRuns |
| docker-converter | 1 | 2 | command | dockerfile, compose |
| whois | 1 | 1 | domain | result |
| uuid | 0 | 1 | — | uuid |
| totp | 1 | 2 | secret | code, remaining |
| color | 1 | 3 | color | hex, rgb, hsl |
| base-converter | 1 | 4 | value | binary, octal, decimal, hex |
| temperature-converter | 1 | 3 | value | celsius, fahrenheit, kelvin |
| currency | 1 | 1 | amount | result |
| bmi | 2 | 2 | weight, height | bmi, category |
| device-info | 0 | 1 | — | info |
| office-viewer | 1 | 1 | file | info |
| time | 0 | 4 | — | timestamp, iso, formatted, parts |

---

## 3. 功能验证测试

### 3.1 测试方案

对每组可测试的工具节点：
1. 创建基础数据类型节点（String/Number）作为输入源，设置 config.value
2. 创建工具节点
3. 创建输出基础节点（String/Number/JSON）
4. 连接链路：输入源 → 工具 → 输出节点
5. 调用 `store.executeAll()`
6. 从 `store.getState().nodeOutputs` 读取输出节点的值
7. 断言输出值的正确性

### 3.2 测试链路表

#### A 组：确定性输出（精确断言）

| # | 链路 | 输入值 | 预期输出 |
|---|------|--------|----------|
| 1 | String("hello") → Hash(SHA-256) → String | "hello" | `2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824` |
| 2 | String("hello") → Encoding(Base64) → String | "hello" | `aGVsbG8=` |
| 3 | String("aGVsbG8=") → Encoding(Base64-Decode) → String | "aGVsbG8=" | `hello` |
| 4 | String("hello world") → Case Converter → String(upper) | "hello world" | `HELLO WORLD` |
| 5 | String("10") → Base Converter → String(hex) | "10" | `a` |
| 6 | String('{"a":1}') → JSON Format → String(minified) | `{"a":1}` | `{"a":1}` |
| 7 | String("hello") → Classic Cipher(ROT13) → String | "hello" | `uryyb` |
| 8 | String("hello") → Text Stats → JSON | "hello" | `{characters:5, words:1, ...}` |
| 9 | String("* * * * *") → Crontab → JSON | "* * * * *" | `{parsed:{...}, nextRuns:[...]}` |
| 10 | Number(100) → Temperature(C→F) → Number | 100 | 212 |
| 11 | Number(70) / Number(1.75) → BMI → Number | 70, 1.75 | 22.86 |
| 12 | String("#ff0000") → Color → String(hex) | "#ff0000" | `#ff0000` |
| 13 | String("eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.xxx") → JWT → JSON(header) | JWT string | `{alg:"HS256"}` |

#### B 组：格式可验证（类型/存在性断言）

| # | 链路 | 验证方式 |
|---|------|----------|
| 1 | String("hello") → HMAC → String | output 存在且为 string |
| 2 | String("hello") → Crypto → String | output 存在且为 string |
| 3 | String("test") → Regex → JSON(matches) | output 存在且为 array |
| 4 | String("abc") / String("abd") → Diff → JSON | output 存在且含 changes |
| 5 | String("* * * * *") → Crontab → JSON(nextRuns) | output 存在且为 array |

#### C 组：需要文件输入（仅端口测试）

| 节点 | 原因 |
|------|------|
| image-to-base64 | 需要 File 对象 |
| exif-viewer | 需要图片文件 |
| image-compress | 需要图片文件 |
| image-editor | 需要图片文件 |
| qrcode | 需要生成图片 |
| qrcode-decode | 需要图片文件 |
| meme-splitter | 需要图片文件 |
| image-coordinates | 需要图片文件 |
| office-viewer | 需要文档文件 |

#### D 组：无输入源节点（直接 execute）

| # | 节点 | 验证方式 |
|---|------|----------|
| 1 | UUID | execute → output 存在且为 string，匹配 UUID 格式 |
| 2 | Time | execute → output 包含 timestamp (number), iso (string) |
| 3 | Device Info | execute → output 存在且为 object |

#### E 组：跳过功能测试（需网络/外部服务）

| 节点 | 原因 |
|------|------|
| http-tester | 需要网络请求 |
| whois | 需要 whois 服务 |
| totp | 需要时间同步 |
| currency | 需要汇率 API |
| docker-converter | 输出为模板字符串，无实际数据转换 |

---

## 4. 测试文件结构

### 4.1 文件组织

```
e2e/
├── canvas.spec.ts                    # 现有测试（保留）
└── canvas-nodes.spec.ts              # 新增：全节点覆盖测试
```

### 4.2 测试用例结构

```typescript
// e2e/canvas-nodes.spec.ts

test.describe("Canvas Node Port Verification", () => {
  // 为每个节点类型生成一个 test case
  // 使用 store.addNode() 创建节点
  // 统计 handle 数量
})

test.describe("Canvas Tool Functional Tests", () => {
  test.describe("Deterministic Output (Group A)", () => {
    // 13 个确定性链路测试
  })
  
  test.describe("Format Verification (Group B)", () => {
    // 5 个格式验证测试
  })
  
  test.describe("Source Nodes (Group D)", () => {
    // 3 个无输入源节点测试
  })
})
```

### 4.3 辅助函数

```typescript
// 通过 store 创建节点并返回 node id
async function addNode(page, type: string, config: Record<string, unknown>): Promise<string>

// 通过 store 连接两个节点
async function connectNodes(page, sourceId: string, sourcePort: string, targetId: string, targetPort: string): Promise<void>

// 执行所有节点并返回指定节点的输出
async function executeAndGetOutput(page, nodeId: string, portId: string): Promise<unknown>

// 统计节点上的 input/output handle 数量
async function countHandles(page, nodeId: string): Promise<{ inputs: number; outputs: number }>
```

---

## 5. 验收标准

| 检查项 | 标准 |
|--------|------|
| 端口数量测试 | 39 个节点全部通过 |
| A 组功能测试 | 13 个确定性链路全部通过 |
| B 组格式测试 | 5 个格式验证全部通过 |
| D 组源节点测试 | 3 个无输入源节点全部通过 |
| 总计 | 60 个测试用例 |

---

## 6. 测试数据

### 6.1 确定性测试输入/输出对

| 链路 | 输入 | 预期输出 |
|------|------|----------|
| Hash(SHA-256) | "hello" | `2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824` |
| Hash(MD5) | "hello" | `5d41402abc4b2a76b9719d911017c592` |
| Encoding(Base64) | "hello" | `aGVsbG8=` |
| Encoding(URL) | "hello world" | `hello%20world` |
| Encoding(HEX) | "hi" | `6869` |
| Case Converter(upper) | "hello world" | `HELLO WORLD` |
| Case Converter(lower) | "HELLO WORLD" | `hello world` |
| Base Converter(10→hex) | "255" | `ff` |
| Base Converter(10→binary) | "5" | `101` |
| Classic Cipher(ROT13) | "hello" | `uryyb` |
| Classic Cipher(Caesar,3) | "abc" | `def` |
| Text Stats | "hello world" | `{characters:11, words:2, ...}` |
| Temperature(C→F) | 100 | 212 |
| Temperature(C→K) | 0 | 273.15 |
| BMI | 70kg / 1.75m | 22.86 |
| Color | "#ff0000" | hex: "#ff0000", rgb: {r:255,g:0,b:0} |
