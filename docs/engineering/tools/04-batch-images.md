---
description: Bounded local image queues for OCR, compression, resizing and format conversion
type: Permanent
---

# 图片批处理队列

`/tools/image-batch` 与 OCR 的批量模式共用 `ImageBatchPanel`。队列最多 30 张、120 MB，每张沿用 [[02-browser-ocr]] 的 20 MB / 2000 万像素限制。输出总量最多 120 MB，单个图像文件最多 64 MB。只接收 PNG、JPEG、WebP 的字节头；动态输入只处理第一帧。

OCR 队列复用 `createOcrSession`，避免每张图重新初始化模型。文件头错误在模型调用前拦截；单张识别错误会关闭已失效的会话，下一张可以新建会话继续。压缩和转换在专用 Worker 中调用已有 `convertImageFile`：支持 JPEG、PNG、WebP，按比例缩小、EXIF 方向归一化，JPEG 铺白、PNG/WebP 保留透明度。转换 Worker 的单次上限为 60 秒，OCR 单张上限为 5 分钟。

队列顺序执行，失败只影响当前文件。取消、隐藏面板或卸载会终止当前 Worker，并阻止迟到结果写回；已经完成的结果保留，正在运行的文件回到待处理状态。再次运行只执行待处理项，另有失败重试和全部重跑。修改参数清除旧结果，重新生成所有项目，避免不同配置混在一个导出里。

每个来源进入队列时分配独立文件名，跨扩展名、大小写、Unicode 规范化和已有数字后缀处理冲突，并移除目录分隔符、控制字符和 Windows 保留文件名。保留稳定名称直到移除队列项，重试不会改变输出路径。

OCR TXT 与全文汇总使用校对后的内容；JSON 保留原始识别框、置信度和编辑文本。ZIP 使用已有可取消 `createZip`，已完成图像写入 images、文本写入 text、JSON 写入 data；根目录 manifest.json 记录完整队列及失败/待处理状态。任何编辑、移除或重新运行都会撤销旧 ZIP 下载地址。

测试覆盖文件名冲突、单张失败后继续、取消后保留结果并恢复剩余项、旧回调丢弃、Worker 终止、校对文本和 ZIP 清单。实际浏览器验证混合有效/损坏文件、模型复用、同名文件完整导出、JPEG 格式与缩放尺寸、透明区域白底和移动布局。
