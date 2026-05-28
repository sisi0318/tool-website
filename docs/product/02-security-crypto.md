---
description: 安全与加密领域 - Hash、HMAC、Crypto、经典密码、JWT、JCE、TOTP 功能说明
type: Literature
---

# 安全与加密

## 功能列表

| 工具 | 功能描述 | 核心能力 |
|------|----------|----------|
| Hash 计算器 | 计算多种哈希值 | MD5, SHA1/2/3, SHAKE, CRC32；支持文本/文件模式；自动计算；验签；并行输出全部算法结果 |
| HMAC 计算器 | 计算 HMAC 值 | HMAC-MD5/SHA1/SHA256/SHA512；支持密钥生成；签名验证 |
| Crypto 加解密 | 对称加解密工具 | AES(CBC/ECB/CTR/GCM/CFB/OFB), DES, 3DES, Blowfish, RC4, Rabbit；支持文本和文件模式 |
| 经典密码 | 古典密码学工具 | Caesar（凯撒）、Vigenere（维吉尼亚）、Atbash（反向字母）密码 |
| JWT 解析 | JSON Web Token 解码 | 解析 Header/Payload/Signature；检查过期时间 |
| JCE 解析 | 腾讯 Tars/JCE 协议解析 | 二进制协议数据的解析和编码 |
| TOTP 认证器 | 时间基一次性密码 | Google Authenticator 兼容；多账户管理；动态刷新 |

## 用户价值

- 开发者日常调试和安全验证的一站式工具箱
- 无需命令行工具即可快速完成加解密操作
- TOTP 认证器可作为二次验证的备用方案

## 相关文档

- [[01-overview]]
