# Product 目录指南

## 用途

记录 Tool Station（工具站）的产品功能描述，面向产品经理、需求方和新手开发者。

## 文档列表

| 文档 | 领域 | 覆盖工具 |
|------|------|----------|
| [[01-overview]] | 项目概览 | 全站功能图谱 |
| [[02-security-crypto]] | 安全与加密 | Hash, HMAC, AES/DES/RC4, 经典密码, JWT, JCE, TOTP |
| [[03-encoding-data]] | 编码与数据 | Base64/URL/Hex, JSON, Protobuf, 进制转换, 大小写转换 |
| [[04-image-media]] | 图片与媒体 | QR码(生成/解码), 图片Base64, 压缩, 编辑, 坐标拾取, EXIF, 表情包分割, 取色器 |
| [[05-conversion]] | 格式转换 | 温度转换, 汇率转换, Docker转换, Crontab生成 |
| [[06-text-analysis]] | 文本分析 | 文本统计, 正则测试, 文本对比 |
| [[07-network-tools]] | 网络工具 | WHOIS查询, HTTP请求调试, 设备信息 |
| [[08-system-time]] | 系统与时间 | 时间工具, UUID生成, BMI计算 |
| [[09-document-tools]] | 文档查看 | Office文档预览 |

## 规范

- 每个文档以 YAML front matter 开头
- 类型使用 `Literature`（参考资料级产品描述）
- 聚焦"做什么"和"为什么"，不涉及技术实现
