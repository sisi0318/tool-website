# Canvas 节点修复与新增技术方案

## 概述
本次改动涉及 15 个问题，包括重构 Hash 节点、新增多个节点、修复现有节点问题。

---

## 1. Hash Node 重构

**文件**: `lib/adapters/hash.ts`

**变更**:
- 删除现有 `variant` 字段
- 新增 `category` 字段（select，8 个选项：MD/SHA1/SHA2/SHA3/RIPEMD/BLAKE2/SM3/CRC）
- 新增 `algorithm` 字段（select，使用 `dependsOn: "category"` + `dynamicOptions` 根据 category 显示对应算法）
- 保留 `data` 字段（string, hasInput）
- 保留 `outputFormat` 字段（hex/base64）
- `outputs`: `hash` (string)

**Algorithm 映射**:
| Category | Algorithm 选项 | Node.js crypto 值 |
|----------|---------------|-------------------|
| MD | MD5 | `md5` |
| SHA1 | SHA-1 | `sha1` |
| SHA2 | SHA-2-224, SHA-2-256, SHA-2-384, SHA-2-512, SHA-512/t-224, SHA-512/t-256 | `sha224`, `sha256`, `sha384`, `sha512`, 需自实现 512/t |
| SHA3 | SHA-3/NIST-224, SHA-3/NIST-256, SHA-3/NIST-384, SHA-3/NIST-512, Keccak-224, Keccak-256, Keccak-384, Keccak-512, SHAKE-128, SHAKE-256 | `sha3-224`, `sha3-256`, `sha3-384`, `sha3-512`, 需用 `sha3` 包的 Keccak/SHAKE |
| RIPEMD | RIPEMD-160 | `ripemd160` |
| BLAKE2 | BLAKE2s-256, BLAKE2s-512 | 需自实现（Node.js crypto 不支持 BLAKE2s） |
| SM3 | SM3 | Node.js crypto 不支持，需用 `sm-crypto` 包 |
| CRC | CRC32 | 需自实现（crc32 算法） |

**依赖检查**:
- `sha3` 包已安装 → 用于 SHA3/Keccak/SHAKE
- BLAKE2s/BLAKE2b/SM3 → 调用 `/api/hash` 服务端接口（Node.js crypto 原生支持）
- CRC32 → 自实现（参考 `app/tools/hash/page.tsx` 的 `crc32Bytes` 函数）
- SHA-512/t → 调用 `/api/hash` 服务端接口（`createHash('sha512-224')` / `createHash('sha512-256')`）

**execute 逻辑**:
```
1. SHA3/Keccak/SHAKE → 使用 sha3 包（浏览器端）
2. SHA-512/t, BLAKE2s-256, BLAKE2b-512, SM3 → 调用 /api/hash 服务端接口
3. CRC32 → 自实现 crc32Bytes 函数
4. 其他（MD5, SHA1, SHA2, RIPEMD）→ 使用 crypto-browserify 或调用 /api/hash
```

---

## 2. Hash Verify Node（新增）

**文件**: `lib/adapters/hash-verify.ts`

**类型**: `"hash-verify"`, category: `"crypto"`

**Config 字段**:
| 字段 | 类型 | hasInput | hasOutput | 说明 |
|------|------|----------|-----------|------|
| data | string | true | false | 待验证数据 |
| hash | string | true | false | 预期的 Hash 值 |
| category | string | false | false | 同 Hash Node |
| algorithm | string | false | false | 同 Hash Node（dependsOn category） |

**Outputs**: `valid` (boolean)

**execute 逻辑**:
```
1. 复用 Hash Node 的算法映射
2. 计算 data 的 hash
3. 与输入的 hash 比较（支持 hex 和 base64 格式）
4. 返回 boolean
```

---

## 3. HMAC Verify Node（新增）

**文件**: `lib/adapters/hmac-verify.ts`

**类型**: `"hmac-verify"`, category: `"crypto"`

**Config 字段**:
| 字段 | 类型 | hasInput | hasOutput | 说明 |
|------|------|----------|-----------|------|
| expectedHmac | string | true | false | 预期的 HMAC 值 |
| data | string | true | false | 待验证数据 |
| key | string | true | false | HMAC 密钥 |
| algorithm | string | false | false | select: MD5/SHA-1/SHA-256/SHA-384/SHA-512 |

**Outputs**: `valid` (boolean)

**execute 逻辑**:
```
1. 计算 HMAC(data, key, algorithm)
2. 与 expectedHmac 比较（支持 hex 和 base64 格式）
3. 返回 boolean
```

---

## 4. Crypto Node 增加 IV 参数

**文件**: `lib/adapters/crypto.ts`

**变更**:
- 新增 `iv` 字段（string, hasInput, hasOutput）
- 使用 `crypto-js` 包实现真正的加密/解密（包已安装）
- CBC/CFB/OFB 模式需要 IV
- ECB 模式不需要 IV（动态隐藏）

**Config 新增字段**:
```
iv: {
  id: "iv",
  name: "IV",
  dataType: "string",
  defaultValue: "",
  hasInput: true,
  hasOutput: true,
  dependsOn: "mode",
  dynamicOptions: (mode) => mode === "ECB" ? [] : [{ label: "16 bytes", value: "16" }]
}
```

**execute 实现**:
```javascript
import CryptoJS from "crypto-js"

// 根据 algorithm 选择 CryptoJS.AES / CryptoJS.DES / CryptoJS.TripleDES
// 根据 mode 选择 CryptoJS.mode.CBC / ECB / CFB / OFB / CTR
// 根据 operation 选择 encrypt / decrypt
// IV 作为 CryptoJS.enc.Hex.parse(iv)
```

---

## 5. Classic Cipher: Shift 字段修改

**文件**: `lib/adapters/classic-cipher.ts`

**变更**:
- 当 algorithm 为 `rot13` 或 `atbash` 时，`shift` 字段不渲染
- 当前使用 `dynamicOptions` 返回空数组来隐藏，但用户要求统一改成数字输入框
- 移除 `slider` 配置，改为纯数字输入框
- 使用 `dependsOn` + `dynamicOptions` 控制显示/隐藏

**修改**:
```typescript
{
  id: "shift",
  name: "Shift",
  dataType: "number",
  defaultValue: 3,
  // 移除 slider: { min: 1, max: 25, step: 1 }
  dependsOn: "algorithm",
  dynamicOptions: (algorithm) => algorithm === "caesar" ? [{ label: "1-25", value: "1-25" }] : [],
  hasInput: true,
  hasOutput: true,
}
```

---

## 6. Encoding Node: 增加 5 种编码

**文件**: `lib/adapters/encoding.ts`

**新增编码**:
| 编码 | 实现方式 |
|------|---------|
| Base58 | 自实现（Bitcoin 字母表：123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz）|
| Base85 | 自实现（ASCII85）|
| Octal | `charCodeAt().toString(8)` / `String.fromCharCode(parseInt(part, 8))` |
| Punycode | 自实现（简化版）|
| Quoted-Printable | 自实现（=XX 格式）|

**修改**:
1. `ENCODING_TYPES` 数组增加 5 个选项
2. `encode()` 函数增加 5 个 case
3. `decode()` 函数增加 5 个 case

**实现参考**: `app/tools/encoding/page.tsx` 中已有 Base58/Base85/Punycode 的完整实现，可直接复用。

---

## 7. Currency Node: 使用真实汇率 API

**文件**: `lib/adapters/currency.ts`

**变更**:
- 移除硬编码汇率
- 调用 `https://open.er-api.com/v6/latest/{baseCurrency}` API
- 添加客户端缓存（1 小时 TTL）
- 扩展支持 25+ 种货币（复用 `app/tools/currency/page.tsx` 的货币列表）

**execute 逻辑**:
```javascript
// 1. 检查 localStorage 缓存
// 2. 无缓存则 fetch API
// 3. 计算 cross-rate: rate = rates[to] / rates[from]
// 4. 返回 converted 和 rate
```

**问题**: Canvas 节点在浏览器端执行，可以直接 fetch。但需要处理 CORS 和网络错误。

**货币列表**: USD, EUR, GBP, JPY, CNY, KRW, AUD, CAD, CHF, HKD, SGD, THB, MYR, IDR, PHP, VND, INR, RUB, BRL, MXN, ZAR, SEK, NOK, DKK, PLN, TRY, NZD

---

## 8. QRCode Node: 使用 qrcode.react

**文件**: `lib/adapters/qrcode.ts`

**变更**:
- 移除自定义 `generateQRPattern` 函数
- 使用 `qrcode.react` 包的 `QRCodeSVG` 组件（已安装）
- 参考 `app/tools/qrcode/page.tsx` 的实现方式

**execute 逻辑**:
```javascript
import { QRCodeSVG } from "qrcode.react"

// 1. 创建隐藏 DOM 容器
// 2. 使用 ReactDOM.createRoot 渲染 QRCodeSVG 到容器
// 3. 获取 SVG 元素并序列化为字符串
// 4. 创建 Image 对象加载 SVG
// 5. 绘制到 Canvas 上
// 6. canvas.toDataURL("image/png") 获得 PNG data URI
// 7. 返回 File 和 dataUri
```

**参考实现**: `app/tools/qrcode/page.tsx` 中的 `handleDownload` 函数已实现 SVG → Canvas → PNG 的转换流程。

---

## 9. JSON Path Node: 入参改为 JSON 类型，增加多类型输出

**文件**: `lib/adapters/json-path.ts`

**变更**:
- `json` 字段 `dataType` 从 `"string"` 改为 `"json"`
- `outputs` 增加 5 个输出端口：

```typescript
outputs: [
  { id: "string", name: "String", dataType: "string" },
  { id: "number", name: "Number", dataType: "number" },
  { id: "boolean", name: "Boolean", dataType: "boolean" },
  { id: "object", name: "Object", dataType: "json" },
  { id: "array", name: "Array", dataType: "json" },
]
```

**execute 逻辑**:
```javascript
const result = getByPath(parsed, path)
return {
  string: typeof result === "string" ? result : JSON.stringify(result),
  number: typeof result === "number" ? result : Number(result) || 0,
  boolean: typeof result === "boolean" ? result : Boolean(result),
  object: typeof result === "object" && !Array.isArray(result) ? result : null,
  array: Array.isArray(result) ? result : null,
}
```

---

## 10. JSON Stringify Node（新增）

**文件**: `lib/adapters/json-stringify.ts`

**类型**: `"json-stringify"`, category: `"data"`

**Config**:
| 字段 | 类型 | hasInput | hasOutput |
|------|------|----------|-----------|
| json | json | true | false |

**Outputs**: `string` (string)

**execute**: `JSON.stringify(inputs.json)`

---

## 11. JSON Parse Node（新增）

**文件**: `lib/adapters/json-parse.ts`

**类型**: `"json-parse"`, category: `"data"`

**Config**:
| 字段 | 类型 | hasInput | hasOutput |
|------|------|----------|-----------|
| string | string | true | false |

**Outputs**: `json` (json)

**execute**: `JSON.parse(inputs.string)`

---

## 12. JSON Preview Node: 入参改为 JSON 类型

**文件**: `lib/adapters/json-preview.ts`

**变更**:
- `json` 字段 `dataType` 从 `"string"` 改为 `"json"`
- execute 中移除 `JSON.parse`（输入已经是 JSON 对象）

---

## 13. JSON to YAML Node（新增）

**文件**: `lib/adapters/json-to-yaml.ts`

**类型**: `"json-to-yaml"`, category: `"data"`

**依赖**: `js-yaml`（已安装）

**Config**:
| 字段 | 类型 | hasInput | hasOutput |
|------|------|----------|-----------|
| json | json | true | false |

**Outputs**: `yaml` (string)

**execute**: `yaml.dump(inputs.json)`

---

## 14. YAML to JSON Node（新增）

**文件**: `lib/adapters/yaml-to-json.ts`

**类型**: `"yaml-to-json"`, category: `"data"`

**依赖**: `js-yaml`（已安装）

**Config**:
| 字段 | 类型 | hasInput | hasOutput |
|------|------|----------|-----------|
| yaml | string | true | false |

**Outputs**: `json` (json)

**execute**: `yaml.load(inputs.yaml)`

---

## 15. Device Info Node: 放置时立即计算

**文件**: `lib/adapters/device-info.ts`

**变更**:
- 当前 execute 已经在浏览器端立即计算
- 需要在节点放置到画布时自动触发 execute
- 修改 store 或 BaseNode 逻辑：对于无 config 输入的节点（`config` 数组为空），放置后自动执行

**实现方案**:
在 `components/canvas/nodes/ToolNode.tsx` 中，useEffect 检测节点首次渲染且 config 为空时自动调用 executeNode。

---

## 文件变更汇总

| 文件 | 操作 | 说明 |
|------|------|------|
| `lib/adapters/hash.ts` | 重构 | Category/Algorithm 级联选择 |
| `lib/adapters/hash-verify.ts` | 新增 | Hash 验证节点 |
| `lib/adapters/hmac-verify.ts` | 新增 | HMAC 验证节点 |
| `lib/adapters/crypto.ts` | 修改 | 增加 IV，实现真实加密 |
| `lib/adapters/classic-cipher.ts` | 修改 | Shift 改为纯数字输入框 |
| `lib/adapters/encoding.ts` | 修改 | 增加 5 种编码 |
| `lib/adapters/currency.ts` | 重构 | 使用真实汇率 API |
| `lib/adapters/qrcode.ts` | 重构 | 使用 qrcode 库 |
| `lib/adapters/json-path.ts` | 修改 | JSON 类型入参，多类型输出 |
| `lib/adapters/json-stringify.ts` | 新增 | JSON → String |
| `lib/adapters/json-parse.ts` | 新增 | String → JSON |
| `lib/adapters/json-preview.ts` | 修改 | 入参改为 JSON 类型 |
| `lib/adapters/json-to-yaml.ts` | 新增 | JSON → YAML |
| `lib/adapters/yaml-to-json.ts` | 新增 | YAML → JSON |
| `lib/adapters/device-info.ts` | 修改 | 放置时自动执行 |
| `lib/adapters/index.ts` | 修改 | 注册新节点 |
| `components/canvas/nodes/ToolNode.tsx` | 修改 | 支持自动执行 |

---

## 待确认问题

无（已全部确认）

---

## 实现顺序建议

1. **Phase 1**（基础重构）: #5 Classic Cipher, #12 JSON Preview, #15 Device Info
2. **Phase 2**（JSON 系列）: #9 JSON Path, #10 JSON Stringify, #11 JSON Parse, #13 JSON to YAML, #14 YAML to JSON
3. **Phase 3**（Crypto 系列）: #1 Hash, #2 Hash Verify, #3 HMAC Verify, #4 Crypto IV
4. **Phase 4**（工具增强）: #6 Encoding, #7 Currency, #8 QRCode
