# 低代码节点化工具平台 V3 - 产品方案

## 1. 概述

基于 V2 实现后的手动测试反馈，优化节点参数编辑体验。

### 问题

| 问题 | 现状 | 目标 |
|------|------|------|
| 工具节点无参数编辑 | Hash 节点无法选择算法 | 节点内显示所有参数 |
| 参数与端口分离 | 端口在上下，参数不可见 | 参数与端口同行展示 |
| 基础类型单一 | String 只有文本框 | 支持下拉单选 |
| Number 无滑块 | 只有数字输入框 | 支持 Slider |
| 无联动选项 | 算法变种无法选择 | 选项 A 变化后，选项 B 联动 |

---

## 2. 节点参数行设计

### 2.1 布局规则

每个节点内部按**参数行**组织，每行一个参数：

```
┌─────────────────────────────────┐
│ [Icon] Node Label               │
├─────────────────────────────────┤
│ ● input port    [参数值/控件]   │  ← 参数行（有端口时端口在左）
│ ● data port     [▼ 下拉选择]    │
│ ● key port      [━━━━━━━━●━━━]  │  ← Slider
├─────────────────────────────────┤
│                 [输出值]  ● out  │  ← 输出行（端口在右）
└─────────────────────────────────┘
```

### 2.2 参数行类型

| 参数类型 | 控件 | 触发条件 | 基础类型 |
|----------|------|----------|----------|
| 文本输入 | `<input type="text">` | `dataType=string` 且无 `options` | String |
| 数字输入 | `<input type="number">` | `dataType=number` 且无 `options` | Number |
| 下拉单选 | `<select>` | 有 `options` | String |
| 滑块 | `<input type="range">` | `dataType=number` 且有 `slider` 配置 | Number |

### 2.3 端口与参数同行

当参数对应一个端口时，端口和参数在同一行显示：

```
左侧端口（输入）:
● input    [━━━━━━━━━━━━━━━]   ← 端口在左，参数在右

右侧端口（输出）:
              [输出值展示]  ●   ← 参数在左，端口在右
```

---

## 3. 基础类型扩展

### 3.1 String 扩展

| 展现形式 | 说明 | 示例 |
|----------|------|------|
| 文本输入框 | 默认，单行文本 | String 节点 |
| 下拉单选 | 有 options 时自动切换 | Encoding 选择编码类型 |

### 3.2 Number 扩展

| 展现形式 | 说明 | 示例 |
|----------|------|------|
| 数字输入框 | 默认 | Number 节点 |
| 滑块 (Slider) | 有 slider 配置时 | Image Compress 质量 |

### 3.3 Slider 配置

```typescript
interface SliderConfig {
  min: number      // 最小值
  max: number      // 最大值
  step: number     // 步长
}
```

在 `ConfigField` 中通过 `slider` 字段配置：

```typescript
interface ConfigField {
  id: string
  name: string
  dataType: "string" | "number" | "json" | "bytes"
  defaultValue?: unknown
  options?: Array<{ label: string; value: string }>
  slider?: SliderConfig  // 新增：Slider 配置
}
```

---

## 4. 联动选项

### 4.1 需求场景

Hash 节点：
- 选择 SHA-256 → 无额外选项
- 选择 SHA-512 → 无额外选项
- 选择 SHA3 → 显示变种选项：SHA3-256, SHA3-512, SHAKE128, SHAKE256

### 4.2 联动规则

```typescript
interface ConfigField {
  // ... existing fields
  dependsOn?: string           // 依赖的参数 ID
  dynamicOptions?: (dependentValue: string) => Array<{ label: string; value: string }>
}
```

### 4.3 联动流程

```
用户选择 Algorithm = "sha3"
  → 系统调用 dynamicOptions("sha3")
  → 返回变种选项列表
  → 渲染新的下拉选择
```

---

## 5. 参数行组件映射

### 5.1 全量参数清单

| 节点 | 参数 | 类型 | 端口? | 控件 |
|------|------|------|-------|------|
| **basic** ||||
| String | value | string | ● input | 文本输入 / 下拉单选 |
| Number | value | number | ● input | 数字输入 / 滑块 |
| JSON | value | string | ● input | 多行文本 |
| File | file | bytes | ● input | 文件上传 |
| **crypto** ||||
| Hash | algorithm | string | — | 下拉单选 (联动) |
| HMAC | algorithm | string | — | 下拉单选 |
| Crypto | algorithm | string | — | 下拉单选 |
| Crypto | mode | string | — | 下拉单选 |
| Encoding | encoding | string | — | 下拉单选 |
| Classic Cipher | cipher | string | — | 下拉单选 |
| Classic Cipher | shift | number | — | 数字输入 |
| JWT | _(无参数)_ | | | |
| **data** ||||
| JSON Format | indent | number | — | 滑块 (1-8, step=1) |
| Protobuf | mode | string | — | 下拉单选 |
| JCE | mode | string | — | 下拉单选 |
| **image** ||||
| Image to Base64 | _(无参数)_ | | | |
| EXIF Viewer | _(无参数)_ | | | |
| Image Compress | quality | number | — | 滑块 (1-100, step=1) |
| Image Editor | brightness | number | — | 滑块 (0-200, step=1) |
| Image Editor | contrast | number | — | 滑块 (0-200, step=1) |
| Image Editor | grayscale | string | — | 下拉单选 |
| QRCode | size | number | — | 滑块 (100-500, step=10) |
| QRCode | errorCorrection | string | — | 下拉单选 |
| QRCode Decode | _(无参数)_ | | | |
| Meme Splitter | rows | number | — | 数字输入 |
| Meme Splitter | cols | number | — | 数字输入 |
| Image Coordinates | _(无参数)_ | | | |
| **text** ||||
| Text Stats | _(无参数)_ | | | |
| Case Converter | _(无参数)_ | | | |
| Regex | pattern | string | — | 文本输入 |
| Regex | flags | string | — | 文本输入 |
| Regex | replacement | string | — | 文本输入 |
| Diff | _(无参数)_ | | | |
| **dev** ||||
| HTTP Tester | method | string | — | 下拉单选 |
| HTTP Tester | headers | string | — | 文本输入 |
| Crontab | _(无参数)_ | | | |
| Docker Converter | format | string | — | 下拉单选 |
| Whois | _(无参数)_ | | | |
| **utility** ||||
| UUID | version | string | — | 下拉单选 |
| TOTP | _(无参数)_ | | | |
| Color | _(无参数)_ | | | |
| Base Converter | fromBase | string | — | 下拉单选 |
| Temperature | fromUnit | string | — | 下拉单选 |
| Currency | from | string | — | 下拉单选 |
| Currency | to | string | — | 下拉单选 |
| BMI | _(无参数)_ | | | |
| **viewer** ||||
| Device Info | _(无参数)_ | | | |
| Office Viewer | _(无参数)_ | | | |
| Time | timezone | string | — | 下拉单选 |

### 5.2 统计

| 控件类型 | 数量 | 参数 |
|----------|------|------|
| 下拉单选 | 22 | 有 options 的参数 |
| 数字输入 | 4 | shift, rows, cols, indent (无 slider) |
| 滑块 | 5 | quality, brightness, contrast, size, indent |
| 文本输入 | 5 | pattern, flags, replacement, headers, value (无 options) |
| 多行文本 | 1 | JSON value |
| 文件上传 | 1 | File |

---

## 6. 验收标准

| 检查项 | 标准 |
|--------|------|
| 参数行渲染 | 所有有 config 的节点显示参数行 |
| 下拉单选 | 有 options 的参数渲染为下拉 |
| 滑块 | 有 slider 配置的参数渲染为滑块 |
| 联动选项 | Hash 节点选择 SHA3 后显示变种 |
| 端口同行 | 输入端口与参数在同一行 |
| 执行输出 | 连接基础节点 → 工具 → 基础节点，有正确输出 |
| 单元测试 | 所有参数渲染覆盖 |
