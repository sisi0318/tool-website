# 低代码节点化工具平台 V3 - 产品方案

## 1. 问题回顾

| 问题 | 根因 |
|------|------|
| Hash 节点无法选择算法 | adapter 的 config 未正确渲染 |
| 工具节点无参数编辑 | 只有基础节点有 InlineEditor，工具节点没有 |
| 参数与端口分离 | InlineEditor 在端口下方，不在同行 |
| 基础类型单一 | String 只有文本框，Number 只有数字输入 |
| 无联动选项 | 不支持参数间动态联动 |

---

## 2. 节点参数行设计

### 2.1 布局规则

每个节点内部按**参数行**组织，每行一个参数，端口与参数同行：

```
┌─────────────────────────────────┐
│ [Icon] Node Label               │
├─────────────────────────────────┤
│ ● data port     [输入值展示]    │  ← 输入端口 + 关联参数
│ ● key port      [输入值展示]    │
│                 [▼ Algorithm  ] │  ← 独立参数（下拉）
│                 [●━━━━━━━●━━━]  │  ← 独立参数（滑块）
├─────────────────────────────────┤
│                 [输出值]  ● out  │  ← 输出端口
└─────────────────────────────────┘
```

### 2.2 参数行类型

| 参数类型 | 控件 | 触发条件 |
|----------|------|----------|
| 文本输入 | `<input type="text">` | `dataType=string` 且无 `options` |
| 多行文本 | `<textarea>` | `dataType=string` 且 `multiline=true` |
| 数字输入 | `<input type="number">` | `dataType=number` 且无 `options` 和 `slider` |
| 下拉单选 | `<select>` | 有 `options` |
| 滑块 | `<input type="range">` | 有 `slider` 配置 |
| 开关 | `<input type="checkbox">` | `dataType=boolean` |

---

## 3. 全量工具参数清单

### 3.1 基础节点 (basic)

#### String
| 参数 | 类型 | 端口 | 说明 |
|------|------|------|------|
| value | 文本/下拉 | ● input | 当有 options 时切换为下拉 |

#### Number
| 参数 | 类型 | 端口 | 说明 |
|------|------|------|------|
| value | 数字/滑块 | ● input | 当有 slider 配置时切换为滑块 |

#### JSON
| 参数 | 类型 | 端口 | 说明 |
|------|------|------|------|
| value | 多行文本 | ● input | JSON 编辑器 |

#### File
| 参数 | 类型 | 端口 | 说明 |
|------|------|------|------|
| file | 文件上传 | ● input | 文件选择器 |

---

### 3.2 编码加密 (crypto)

#### Hash
| 参数 | 类型 | 端口 | 默认值 | 选项 | 联动 |
|------|------|------|--------|------|------|
| algorithm | 下拉 | — | sha256 | MD5, SHA-1, SHA-256, SHA-384, SHA-512, SHA3, RIPEMD-160 | → variant |
| variant | 下拉 | — | sha3-256 | SHA3-256, SHA3-384, SHA3-512, SHAKE128, SHAKE256 | 依赖 algorithm=sha3 |
| outputFormat | 下拉 | — | hex | hex, base64 | — |

#### HMAC
| 参数 | 类型 | 端口 | 默认值 | 选项 |
|------|------|------|--------|------|
| algorithm | 下拉 | — | sha256 | MD5, SHA-1, SHA-224, SHA-256, SHA-384, SHA-512, SHA3-256, SHA3-512, RIPEMD-160 |
| keyFormat | 下拉 | — | raw | raw, hex, base64 |
| outputFormat | 下拉 | — | hex | hex, base64 |

#### Crypto
| 参数 | 类型 | 端口 | 默认值 | 选项 | 联动 |
|------|------|------|--------|------|------|
| operation | 下拉 | — | encrypt | encrypt, decrypt | — |
| algorithm | 下拉 | — | aes | AES, DES, TripleDES, Blowfish, RC4, Rabbit | → mode, keySize |
| mode | 下拉 | — | CBC | CBC, ECB, CFB, OFB, CTR | 依赖 algorithm |
| keySize | 下拉 | — | 256 | 128, 192, 256 (AES); 64 (DES); 192 (3DES) | 依赖 algorithm |
| keyFormat | 下拉 | — | hex | raw, hex, base64 | — |
| ivFormat | 下拉 | — | hex | raw, hex, base64 | — |

#### Encoding
| 参数 | 类型 | 端口 | 默认值 | 选项 |
|------|------|------|--------|------|
| encoding | 下拉 | — | base64 | Base64, URL, HEX, HTML, Unicode, UTF-8, ASCII, Base32, Base58, Binary, Morse, ROT13 |

#### Classic Cipher
| 参数 | 类型 | 端口 | 默认值 | 选项 | 联动 |
|------|------|------|--------|------|------|
| algorithm | 下拉 | — | caesar | Caesar, ROT13, Atbash, Vigenere, Playfair, Rail Fence, Columnar, Affine | → 专属参数 |
| shift | 数字 | — | 3 | 1-25 | 依赖 algorithm=caesar |
| key | 文本 | — | "" | — | 依赖 algorithm=vigenere/playfair |
| railCount | 数字 | — | 3 | 2-10 | 依赖 algorithm=rail-fence |
| colKey | 文本 | — | "" | — | 依赖 algorithm=columnar |
| affineA | 数字 | — | 5 | 1-25 | 依赖 algorithm=affine |
| affineB | 数字 | — | 8 | 0-25 | 依赖 algorithm=affine |

#### JWT
| 参数 | 类型 | 端口 | 默认值 | 说明 |
|------|------|------|--------|------|
| _(无参数)_ | | | | 输入 token，输出 header/payload/signature |

---

### 3.3 数据格式 (data)

#### JSON Format
| 参数 | 类型 | 端口 | 默认值 | 说明 |
|------|------|------|--------|------|
| indent | 滑块 | — | 2 | 0-8, step=1 |
| sortKeys | 开关 | — | false | 排序键名 |

#### Protobuf
| 参数 | 类型 | 端口 | 默认值 | 选项 |
|------|------|------|--------|------|
| mode | 下拉 | — | decode | decode, encode |
| indentSize | 数字 | — | 2 | 0-8 |

#### JCE
| 参数 | 类型 | 端口 | 默认值 | 选项 |
|------|------|------|--------|------|
| mode | 下拉 | — | decode | decode, encode |

---

### 3.4 图片处理 (image)

#### Image to Base64
| 参数 | 类型 | 端口 | 默认值 | 选项 |
|------|------|------|--------|------|
| outputFormat | 下拉 | — | base64 | base64, dataUrl, css, html |

#### EXIF Viewer
| 参数 | 类型 | 端口 | 默认值 | 选项 |
|------|------|------|--------|------|
| category | 下拉 | — | all | all, camera, image, location, datetime, technical |

#### Image Compress
| 参数 | 类型 | 端口 | 默认值 | 说明 |
|------|------|------|--------|------|
| quality | 滑块 | — | 80 | 10-100, step=5 |
| outputFormat | 下拉 | — | original | original, jpeg, webp, png |

#### Image Editor
| 参数 | 类型 | 端口 | 默认值 | 说明 |
|------|------|------|--------|------|
| brightness | 滑块 | — | 100 | 0-200, step=1 |
| contrast | 滑块 | — | 100 | 0-200, step=1 |
| saturation | 滑块 | — | 100 | 0-200, step=1 |
| grayscale | 开关 | — | false | — |

#### QRCode
| 参数 | 类型 | 端口 | 默认值 | 选项 |
|------|------|------|--------|------|
| size | 滑块 | — | 200 | 100-500, step=10 |
| errorCorrection | 下拉 | — | M | L(7%), M(15%), Q(25%), H(30%) |
| fgColor | 颜色 | — | #000000 | — |
| bgColor | 颜色 | — | #FFFFFF | — |

#### QRCode Decode
| 参数 | 类型 | 端口 | 默认值 | 说明 |
|------|------|------|--------|------|
| brightness | 滑块 | — | 100 | 50-200, step=5 |
| contrast | 滑块 | — | 100 | 50-200, step=5 |

#### Meme Splitter
| 参数 | 类型 | 端口 | 默认值 | 说明 |
|------|------|------|--------|------|
| rows | 滑块 | — | 4 | 1-10, step=1 |
| cols | 滑块 | — | 6 | 1-10, step=1 |

#### Image Coordinates
| 参数 | 类型 | 端口 | 默认值 | 说明 |
|------|------|------|--------|------|
| _(无参数)_ | | | | 纯交互式坐标拾取 |

---

### 3.5 文本处理 (text)

#### Text Stats
| 参数 | 类型 | 端口 | 默认值 | 说明 |
|------|------|------|--------|------|
| _(无参数)_ | | | | 输入文本，输出统计 |

#### Case Converter
| 参数 | 类型 | 端口 | 默认值 | 说明 |
|------|------|------|--------|------|
| _(无参数)_ | | | | 输入文本，输出 6 种格式 |

#### Regex
| 参数 | 类型 | 端口 | 默认值 | 说明 |
|------|------|------|--------|------|
| pattern | 文本 | — | "" | 正则表达式 |
| flags | 文本 | — | "g" | 标志 (g, i, m, s) |
| replacement | 文本 | — | "" | 替换字符串 |

#### Diff
| 参数 | 类型 | 端口 | 默认值 | 说明 |
|------|------|------|--------|------|
| _(无参数)_ | | | | 输入两段文本，输出差异 |

---

### 3.6 开发工具 (dev)

#### HTTP Tester
| 参数 | 类型 | 端口 | 默认值 | 选项 |
|------|------|------|--------|------|
| method | 下拉 | — | GET | GET, POST, PUT, DELETE, PATCH |
| headers | 文本 | — | "{}" | JSON 格式 |

#### Crontab
| 参数 | 类型 | 端口 | 默认值 | 说明 |
|------|------|------|--------|------|
| _(无参数)_ | | | | 输入表达式，输出解析结果 |

#### Docker Converter
| 参数 | 类型 | 端口 | 默认值 | 选项 |
|------|------|------|--------|------|
| format | 下拉 | — | dockerfile | dockerfile, compose |

#### Whois
| 参数 | 类型 | 端口 | 默认值 | 说明 |
|------|------|------|--------|------|
| _(无参数)_ | | | | 输入域名，输出查询结果 |

---

### 3.7 实用工具 (utility)

#### UUID
| 参数 | 类型 | 端口 | 默认值 | 选项 |
|------|------|------|--------|------|
| version | 下拉 | — | v4 | v4 (random), v1 (time-based) |
| uppercase | 开关 | — | false | — |
| withHyphens | 开关 | — | true | — |

#### TOTP
| 参数 | 类型 | 端口 | 默认值 | 说明 |
|------|------|------|--------|------|
| _(无参数)_ | | | | 输入 secret，输出 code |

#### Color
| 参数 | 类型 | 端口 | 默认值 | 说明 |
|------|------|------|--------|------|
| _(无参数)_ | | | | 输入颜色值，输出 hex/rgb/hsl |

#### Base Converter
| 参数 | 类型 | 端口 | 默认值 | 选项 |
|------|------|------|--------|------|
| fromBase | 下拉 | — | 10 | 2, 8, 10, 16, 32, 36, 58, 62, 64 |

#### Temperature Converter
| 参数 | 类型 | 端口 | 默认值 | 选项 |
|------|------|------|--------|------|
| fromUnit | 下拉 | — | celsius | Kelvin, Celsius, Fahrenheit, Rankine, Delisle, Newton, Réaumur, Rømer |
| precision | 下拉 | — | 2 | 0, 1, 2, 3, 4 |

#### Currency
| 参数 | 类型 | 端口 | 默认值 | 选项 |
|------|------|------|--------|------|
| from | 下拉 | — | USD | USD, EUR, GBP, JPY, CNY |
| to | 下拉 | — | EUR | USD, EUR, GBP, JPY, CNY |

#### BMI
| 参数 | 类型 | 端口 | 默认值 | 说明 |
|------|------|------|--------|------|
| _(无参数)_ | | | | 输入 weight + height，输出 bmi + category |

---

### 3.8 查看器 (viewer)

#### Device Info
| 参数 | 类型 | 端口 | 默认值 | 说明 |
|------|------|------|--------|------|
| _(无参数)_ | | | | 无输入，输出设备信息 |

#### Office Viewer
| 参数 | 类型 | 端口 | 默认值 | 说明 |
|------|------|------|--------|------|
| _(无参数)_ | | | | 输入文件，输出文件信息 |

#### Time
| 参数 | 类型 | 端口 | 默认值 | 选项 |
|------|------|------|--------|------|
| timezone | 下拉 | — | UTC | UTC, Local |

---

## 4. 统计

| 控件类型 | 数量 | 涉及参数 |
|----------|------|----------|
| 下拉单选 | 42 | 有 options 的参数 |
| 滑块 | 14 | quality, brightness, contrast, saturation, size, rows, cols, indent 等 |
| 文本输入 | 12 | pattern, flags, replacement, headers, key 等 |
| 数字输入 | 6 | shift, railCount, affineA, affineB, indentSize, count |
| 开关 | 8 | uppercase, withHyphens, sortKeys, grayscale 等 |
| 颜色选择 | 2 | fgColor, bgColor |
| 多行文本 | 3 | JSON value, token, expression |

---

## 5. 联动选项清单

| 节点 | 触发参数 | 联动参数 | 联动规则 |
|------|----------|----------|----------|
| Hash | algorithm | variant | algorithm=sha3 → 显示 SHA3 变种 |
| Classic Cipher | algorithm | shift/key/railCount/colKey/affineA/affineB | 不同算法显示不同参数 |
| Crypto | algorithm | mode/keySize | 不同算法有不同的 mode 和 keySize 选项 |
| Crypto | algorithm | iv | 非 ECB 模式需要 IV |
| Image Editor | outputFormat | outputQuality | 非 PNG 时显示质量滑块 |
| Meme Splitter | autoDetect | rows/cols | 自动模式显示 sensitivity，手动模式显示 rows/cols |

---

## 6. 验收标准

| 检查项 | 标准 |
|--------|------|
| 参数行渲染 | 所有有 config 的节点显示参数行 |
| 下拉单选 | 有 options 的参数渲染为下拉 |
| 滑块 | 有 slider 配置的参数渲染为滑块 |
| 开关 | boolean 类型参数渲染为开关 |
| 颜色选择 | 颜色类型参数渲染为颜色选择器 |
| 联动选项 | Hash/Classic Cipher/Crypto 节点参数联动正确 |
| 端口同行 | 输入端口与关联参数在同一行 |
| 执行输出 | 连接基础节点 → 工具 → 基础节点，有正确输出 |
| 单元测试 | 所有参数渲染覆盖 |
