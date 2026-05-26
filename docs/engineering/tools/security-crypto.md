---
description: 安全与加密工具实现 - Hash、HMAC、Crypto、Classic Cipher、JWT、JCE、TOTP 的核心逻辑和使用方式
type: Permanent
---

# 安全与加密工具实现

## 工具列表

| 工具 | 目录 | 核心依赖 |
|------|------|----------|
| Hash 计算器 | `app/tools/hash/` | Node.js `crypto` |
| HMAC 计算器 | `app/tools/hmac/` | Node.js `crypto` |
| Crypto 加解密 | `app/tools/crypto/` | Node.js `crypto` |
| 经典密码 | `app/tools/classic-cipher/` | 自定义算法 |
| JWT 解析 | `app/tools/jwt/` | `jose` |
| JCE 解析 | `app/tools/jce/` | 自定义编码器 |
| TOTP 认证器 | `app/tools/totp/` | `otpauth` |

## Hash 计算器 (`hash/`)

### 核心逻辑

使用 Node.js 内置 `crypto` 模块，通过 API Route 代理计算（避免浏览器端 MD5/SHA 等同步 API 的性能问题）。

**支持的算法**：
- 散列：MD4, MD5, SHA1, SHA224, SHA256, SHA384, SHA512, SHA3-224/256/384/512, RIPEMD160
- 衍生：SHAKE128, SHAKE256, CRC32

**输入模式**：
- 文本模式：直接对输入字符串计算
- 文件模式：分块读取文件，计算最终摘要

**API Route** (`app/api/hash/route.ts`)：
```typescript
// POST /api/hash
{ algo: string, input: string, inputType: 'text' | 'file' }
```

### 使用流程

1. 选择算法（支持多选，同时计算多个结果）
2. 选择输入模式（文本/文件）
3. 输入内容或上传文件
4. 可选：输入已知值进行验签（匹配高亮）

## HMAC 计算器 (`hmac/`)

### 核心逻辑

同样基于 Node.js `crypto` 的 `createHmac` 接口。

**支持的算法**：HMAC-MD5, HMAC-SHA1, HMAC-SHA256, HMAC-SHA512

**参数**：
- 消息输入
- 密钥输入（支持手动输入或随机生成）
- 算法选择

### 与 Hash 的区别

HMAC 需要密钥参数，Hash 不需要。其他交互逻辑类似。

## Crypto 加解密 (`crypto/`)

### 核心逻辑

基于 Node.js `crypto`，支持多种对称加密算法和模式：

| 算法 | 支持模式 |
|------|----------|
| AES | CBC, ECB, CTR, GCM, CFB, OFB, XTS |
| DES | CBC, ECB |
| 3DES | CBC, ECB |
| Blowfish | CBC, ECB, CFB, OFB |
| RC4 | 流式 |
| Rabbit | 流式 |

**参数**：
- 算法 + 模式组合
- 密钥（支持生成）
- IV（向量）/ Nonce
- 输入（文本/文件）
- 编码输出（Hex/Base64/原始字节）

**Padding**：支持 PKCS7 / Zero / None

## 经典密码 (`classic-cipher/`)

### 核心逻辑

完全使用自定义算法实现，无外部依赖。

**支持的密码**：

| 密码 | 算法 |
|------|------|
| Caesar（凯撒） | 字母偏移，key = 偏移量 (1-25) |
| Vigenere（维吉尼亚） | 多表替换，key = 关键词 |
| Atbash（反向） | 字母镜像（A↔Z, B↔Y...） |
| ROT13 | 固定偏移 13 |
| Playfair | 5×5 矩阵双字加密 |
| Rail Fence | 栅栏密码（key = 栅栏数） |
| Bacon | 二进制字母编码 |

### 实现要点

- 大小写自动识别，保留大小写转换
- 非字母字符（数字、空格、标点）原样保留
- Vigenere 自动过滤 key 中的非字母字符

## JWT 解析 (`jwt/`)

### 核心逻辑

使用 `jose` 库（轻量级 JWT 实现，支持 Node.js 和浏览器）。

**功能**：
- 解码：解析 header、payload、signature（不验证签名）
- 验证：使用密钥验证签名
- 签发：使用密钥生成新 JWT

**解析内容**：
- Header：alg, typ, kid 等
- Payload：iss, sub, exp, iat, 自定义 claim
- Signature：Base64URL 编码的签名

### 使用流程

1. 输入 JWT 字符串
2. 自动分割三部分并解码显示
3. 如有密钥可验证签名有效性
4. 自动检测过期并显示剩余有效期

## JCE 解析 (`jce/`)

### 核心逻辑

腾讯 Tars/JCE 二进制协议的解析器和编码器，使用自定义实现。

**JCE 格式**：
- 使用 Type Id + 数据长度前缀
- 支持 int8/16/32/64, float, double, string, map, list, struct
- 特殊类型：0 = marker，255 = end mark

**实现**：
- `readJCE()`: 从 ArrayBuffer 读取并解析为 JS 对象
- `writeJCE()`: 将 JS 对象编码为 ArrayBuffer

### 用途

解析腾讯微服务框架 Tars 的二进制 RPC 数据。

## TOTP 认证器 (`totp/`)

### 核心逻辑

使用 `otpauth` 库实现 Google Authenticator 兼容的 TOTP 算法。

**TOTP 算法**：
```
TOTP = HOTP(K, T)
T = floor((当前时间 - T0) / X)
K = Base32 解码的密钥
X = 时间步长（默认 30 秒）
HOTP = HMAC-SHA1(K, T) % 10^6
```

**参数**：
- 账户名（标签）
- 密钥（Base32 编码，支持扫描二维码或手动输入）
- 时间步长（默认 30）
- Digits（默认 6）

### 使用流程

1. 添加账户（手动输入密钥或扫描 QR）
2. 自动生成 6 位动态验证码（30 秒刷新）
3. 支持多账户管理（侧边栏列表）
4. 一键复制当前验证码

## 相关文档

- [[01-design-system]]
- [[02-frontend-architecture]]