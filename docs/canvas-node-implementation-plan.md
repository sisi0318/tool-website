# Canvas 节点修复与新增实现计划

## 实现阶段

### Phase 1: 基础重构（简单修改，无新依赖）

#### 1.1 Classic Cipher Shift 修改
- **文件**: `lib/adapters/classic-cipher.ts`
- **任务**: 移除 `slider` 配置，保留纯数字输入框
- **变更**: 删除 `slider: { min: 1, max: 25, step: 1 }` 行
- **验证**: `npm run build` + 单元测试

#### 1.2 JSON Preview 入参修改
- **文件**: `lib/adapters/json-preview.ts`
- **任务**: `json` 字段 `dataType` 改为 `"json"`
- **变更**: 
  - `dataType: "string"` → `dataType: "json"`
  - execute 移除 `JSON.parse`，直接使用 `inputs.json`
- **验证**: `npm run build`

#### 1.3 Device Info 自动执行
- **文件**: `components/canvas/nodes/ToolNode.tsx`
- **任务**: 节点放置时自动执行（config 为空时）
- **变更**: 在 ToolNode 中添加 useEffect，当 config 为空时自动调用 executeNode
- **验证**: 手动测试放置 Device Info 节点

---

### Phase 2: JSON 系列节点

#### 2.1 JSON Path 修改
- **文件**: `lib/adapters/json-path.ts`
- **任务**: 入参改 JSON 类型，增加 6 个输出端口
- **变更**:
  - `json` 字段 `dataType: "string"` → `dataType: "json"`
  - `outputs` 增加 string/number/boolean/object/array/type
  - `type` 输出返回 typeof 值（"string"/"number"/"boolean"/"object"/"undefined"）
  - execute 根据 result 类型返回对应值
- **验证**: `npm run build` + 单元测试

#### 2.2 JSON Stringify（新增）
- **文件**: `lib/adapters/json-stringify.ts`（新建）
- **任务**: JSON → String 转换
- **Config**: `json` (json, hasInput)
- **Outputs**: `string` (string)
- **execute**: `JSON.stringify(inputs.json)`
- **注册**: 更新 `lib/adapters/index.ts`

#### 2.3 JSON Parse（新增）
- **文件**: `lib/adapters/json-parse.ts`（新建）
- **任务**: String → JSON 转换
- **Config**: `string` (string, hasInput)
- **Outputs**: `json` (json)
- **execute**: `JSON.parse(inputs.string)`
- **注册**: 更新 `lib/adapters/index.ts`

#### 2.4 JSON to YAML（新增）
- **文件**: `lib/adapters/json-to-yaml.ts`（新建）
- **任务**: JSON → YAML 转换
- **依赖**: `js-yaml`（已安装）
- **Config**: `json` (json, hasInput)
- **Outputs**: `yaml` (string)
- **execute**: `yaml.dump(inputs.json)`
- **注册**: 更新 `lib/adapters/index.ts`

#### 2.5 YAML to JSON（新增）
- **文件**: `lib/adapters/yaml-to-json.ts`（新建）
- **任务**: YAML → JSON 转换
- **依赖**: `js-yaml`（已安装）
- **Config**: `yaml` (string, hasInput)
- **Outputs**: `json` (json)
- **execute**: `yaml.load(inputs.yaml)`
- **注册**: 更新 `lib/adapters/index.ts`

#### 2.6 单元测试
- **文件**: `lib/adapters/execute.test.ts`
- **任务**: 为 5 个新节点添加测试用例
- **验证**: `npx vitest run lib/adapters/execute.test.ts`

---

### Phase 3: Crypto 系列节点

#### 3.1 Hash Node 重构
- **文件**: `lib/adapters/hash.ts`
- **任务**: 重构为 Category/Algorithm 级联选择
- **变更**:
  - 删除 `variant` 字段
  - 新增 `category` 字段（8 个选项）
  - 新增 `algorithm` 字段（dependsOn category + dynamicOptions）
  - execute 实现：
    - SHA3/Keccak/SHAKE → 使用 `sha3` 包
    - SHA-512/t, BLAKE2s, SM3 → 调用 `/api/hash`
    - CRC32 → 自实现（参考 `app/tools/hash/page.tsx` 的 `crc32Bytes`）
    - 其他 → 调用 `/api/hash`
- **验证**: `npm run build` + 单元测试

#### 3.2 Hash Verify（新增）
- **文件**: `lib/adapters/hash-verify.ts`（新建）
- **任务**: Hash 验证节点
- **Config**: data (string), hash (string), category, algorithm
- **Outputs**: valid (boolean)
- **execute**: 复用 Hash Node 算法，计算后比较
- **注册**: 更新 `lib/adapters/index.ts`

#### 3.3 HMAC Verify（新增）
- **文件**: `lib/adapters/hmac-verify.ts`（新建）
- **任务**: HMAC 验证节点
- **Config**: expectedHmac (string), data (string), key (string), algorithm
- **Outputs**: valid (boolean)
- **execute**: 计算 HMAC 后与 expectedHmac 比较
- **注册**: 更新 `lib/adapters/index.ts`

#### 3.4 Crypto Node 增加 IV
- **文件**: `lib/adapters/crypto.ts`
- **任务**: 增加 IV 参数，实现真实加密
- **变更**:
  - 新增 `iv` 字段（dependsOn mode，ECB 时隐藏）
  - 使用 `crypto-js` 包实现加密/解密
- **验证**: `npm run build` + 手动测试

#### 3.5 单元测试
- **文件**: `lib/adapters/execute.test.ts`
- **任务**: 为 Hash/Hash Verify/HMAC Verify 添加测试用例
- **验证**: `npx vitest run lib/adapters/execute.test.ts`

---

### Phase 4: 工具增强

#### 4.1 Encoding Node 增加 5 种编码
- **文件**: `lib/adapters/encoding.ts`
- **任务**: 增加 Base58/Base85/Octal/Punycode/Quoted-Printable
- **变更**:
  - `ENCODING_TYPES` 数组增加 5 个选项
  - `encode()` 函数增加 5 个 case
  - `decode()` 函数增加 5 个 case
  - 实现参考 `app/tools/encoding/page.tsx`
- **验证**: `npm run build` + 单元测试

#### 4.2 Currency Node 使用真实汇率
- **文件**: `lib/adapters/currency.ts`
- **任务**: 使用 API 替代硬编码汇率
- **变更**:
  - 移除硬编码 RATES
  - fetch `https://open.er-api.com/v6/latest/{baseCurrency}`
  - localStorage 缓存（1 小时 TTL）
  - 扩展货币列表（25+ 种）
- **验证**: `npm run build` + 手动测试

#### 4.3 QRCode Node 重构
- **文件**: `lib/adapters/qrcode.ts`
- **任务**: 使用 qrcode.react 生成真实二维码
- **变更**:
  - 删除 `generateQRPattern` 函数
  - 使用 `QRCodeSVG` + SVG → Canvas → PNG 转换
  - 参考 `app/tools/qrcode/page.tsx` 的 `downloadQRCode` 函数
- **验证**: `npm run build` + 手动测试

#### 4.4 单元测试
- **文件**: `lib/adapters/execute.test.ts`
- **任务**: 为 Encoding 新编码添加测试用例
- **验证**: `npx vitest run lib/adapters/execute.test.ts`

---

## 文件变更清单

### 新建文件（6 个）
| 文件 | 说明 |
|------|------|
| `lib/adapters/json-stringify.ts` | JSON Stringify 节点 |
| `lib/adapters/json-parse.ts` | JSON Parse 节点 |
| `lib/adapters/json-to-yaml.ts` | JSON to YAML 节点 |
| `lib/adapters/yaml-to-json.ts` | YAML to JSON 节点 |
| `lib/adapters/hash-verify.ts` | Hash Verify 节点 |
| `lib/adapters/hmac-verify.ts` | HMAC Verify 节点 |

### 修改文件（8 个）
| 文件 | 说明 |
|------|------|
| `lib/adapters/hash.ts` | 重构 Category/Algorithm |
| `lib/adapters/crypto.ts` | 增加 IV，实现真实加密 |
| `lib/adapters/classic-cipher.ts` | 移除 slider |
| `lib/adapters/encoding.ts` | 增加 5 种编码 |
| `lib/adapters/currency.ts` | 使用真实汇率 API |
| `lib/adapters/qrcode.ts` | 使用 qrcode.react |
| `lib/adapters/json-path.ts` | JSON 入参，多类型输出 |
| `lib/adapters/json-preview.ts` | JSON 入参 |
| `lib/adapters/index.ts` | 注册新节点 |
| `lib/adapters/execute.test.ts` | 新增测试用例 |
| `components/canvas/nodes/ToolNode.tsx` | 自动执行支持 |

---

## 验证检查清单

- [ ] `npm run build` 无错误
- [ ] `npx vitest run` 所有测试通过
- [ ] 手动测试每个新节点功能正常
- [ ] Canvas 画布放置节点、连线、执行正常
- [ ] 单元测试覆盖所有新节点的 execute 函数
