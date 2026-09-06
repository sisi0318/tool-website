---
description: Browser-local PaddleOCR integration, model assets, image geometry and verification
type: Permanent
---

# 浏览器 OCR

`/tools/ocr` 使用 PaddleOCR.js 0.4.2、PP-OCRv6_small 检测与识别模型，以及 ONNX Runtime Web 1.29.0。图片只在 Worker 内处理，没有上传接口。画布与数据旅程通过 `lib/adapters/ocr.ts` 使用同一实现，输出文字、识别行及坐标。

## 模型与构建

`npm run dev` 和 `npm run build` 会执行 `scripts/copy-ocr-assets.mjs`。首次构建从 Paddle 官方模型域下载约 31.2 MB 权重，以固定 SHA-256 验证；后续复用 `node_modules/.cache/ocr-models`。CI 需要能够访问清单中的模型域。两个未压缩 tar 保留官方 inference.onnx 与 inference.yml。不要把权重提交进仓库。

运行文件、OpenCV、ONNX WASM 和模型合计约 70 MB，仅用户点击识别后加载。同源 `/ocr/v1/` 使用长期 HTTP 缓存和按需 PWA 缓存，不进入全站预缓存。更改模型、运行依赖或构建适配时必须升级 `OCR_ROOT` 与输出目录版本。图片与识别文本不会写入这些缓存。

官方浏览器 facade 的图片适配器依赖 document。构建脚本校验 SDK 源码 hash，然后仅追加已有核心类的导出；Worker 自行提供 ImageData → OpenCV Mat 适配，识别算法不变。ONNX 使用单线程 WASM，避免为一个工具改变全站 COOP/COEP。ORT 1.29 的 bundle 需要 jsep 版本的 mjs 和 wasm，即使所选后端是 WASM。

## 图像与输出

沿用 [[01-image-vectorization]] 的 PNG/JPEG/WebP 字节头校验，预览及解码前限制 20 MB、2000 万像素、边长 32768。校验不做颜色量化。解码遵循 EXIF，透明区域铺白，支持顺时针 0/90/180/270 度旋转。动画仅第一帧。

原图按最多 1920 × 1280 像素分块，水平重叠 256、竖直重叠 192 像素。每个中心点有唯一归属区域；识别框映射回旋转后的原图坐标后，按中心归属过滤，并删除重叠的同文框。小图可放大至多 2 倍。分块避免把长截图整体缩小，但非常宽的跨块长句和复杂多栏排版仍可能拆行或排序不理想。

默认保留所有非空识别行，置信度小于 0.9 使用橙色提醒。置信度不是正确率，相似字符即便高分仍可能错误。按垂直重叠聚合文字行，同排从左至右排序。预览图最长边为 1800，坐标仍指向旋转后的原尺寸。

可编辑全文与原始行数据分开。TXT、复制和继续处理使用编辑后的文本；JSON 同时输出编辑文本、原始文本、原始框和坐标系说明。取消、替换文件、卸载或 5 分钟超时会终止 Worker，释放模型内存；晚到结果通过任务版本号丢弃。OCR 节点通过内部 `executionTimeoutMs` 同样使用 5 分钟上限，避免画布默认 60 秒或旅程默认 30 秒提前打断首次模型加载；其他节点保留各自默认值，该上限不能通过用户配置延长。

## 验证依据

PDF 扫描件复用同一识别会话，页面渲染、逐行校对与可搜索 PDF 导出见 [[03-pdf-ocr]]。

最初在实际浏览器以相同 Canvas 输入比较 PaddleOCR v5/v6 与 Tesseract 7 的 chi_sim+eng best 模型，包含清晰中英混排、14px 中文、深色背景及约 2.6° 倾斜共四张合成图片。忽略空白、保留标点的 Unicode 字符错误率：v6 为 0.78%、2.35%、0.78%、1.56%；Tesseract 为 4.69%、14.12%、28.91%、7.03%。这是小范围合成样本比较，不代表任意照片的准确率。错误主要包括 0/O、1/l/I。

单元测试覆盖输入边界、分段唯一归属、坐标缩放、排序去重、编辑导出、Worker 取消和超时，以及画布适配。页面内置中英、小字、深色与长截图样本用于真实浏览器回归；示例文本只用于绘图，不传入识别器。
