/** 「pdfOcr」的中文文案：只随用到它的页面加载，调用处写 useTranslations("pdfOcr", zhPdfOcr) */
export const zhPdfOcr = {
  staleResult: "页码或识别参数已改动，下面仍是上次识别的结果；点击“识别所选页面”按新设置重新识别。", confirmRerun: "重新识别会丢弃你对识别文字做的修改。", rerunAnyway: "仍然重新识别", keepEdits: "保留修改",
  error_unsupportedInline: "此 PDF 包含当前 OCR 暂不支持的内联图片，已停止处理以避免生成缺图页面。请从原软件重新导出 PDF 后重试。",
  error_unsupportedContent: "此 PDF 的页面内容编码暂不支持安全检查，已停止处理。请从原软件重新导出 PDF 后重试。",
  error_contentLimit: "PDF 页面内容解压后超出处理上限，已停止处理。请减少页数或重新导出较简单的 PDF。",
  title: "PDF OCR · 扫描件文字识别", description: "选择 PDF 页面，在浏览器里识别中英文。逐行核对后，可提取全文，或生成能够搜索和复制文字的 PDF。文件在本地处理。",
  choose: "选择 PDF", sample: "试试两页扫描件", limits: "文件最多 64 MB、500 页，每次识别最多 30 页。单页最多 800 万像素，累计最多 1.2 亿像素；大页面会按上限缩小。",
  selection: "识别页码", selectionHint: "留空识别全部；支持范围、倒序和重排，如 3,1-2。", resolution: "识别分辨率", recognize: "识别所选页面",
  exportHint: "导出的 PDF 由所选页的静态图像和识别文字层组成，保留当前页面外观；可填写表单、数字签名、链接和书签不随新文件保留。",
  stage_reading: "读取 PDF", stage_rendering: "渲染扫描页面", stage_recognizing: "识别页面文字", stage_writing: "生成可搜索 PDF",
  sourcePage: "原第 {page} 页", reviewHint: "在下方直接改正识别文字，所有导出都会使用校对后的内容。置信度是模型评分，不等于正确率；金额、相似字符请对照原图。",
  noText: "本页没有识别到文字，导出时仍会保留页面图像。", allText: "全部页面文本", generate: "生成可搜索 PDF", download: "下载可搜索 PDF", ready: "PDF 已生成，可以搜索、选中和复制识别文字。",
  error_pageLimit: "每次最多识别 30 页，请填写页码范围分批处理。", error_imageLimit: "页面尺寸或累计像素过大，请降低分辨率或减少页数。", error_sourceImageLimit: "PDF 内嵌的扫描图片超过 2000 万像素，已停止处理以避免生成缺图页面。请先缩小原扫描图片后重新生成 PDF。", error_outputLimit: "页面图像或文字结果过大，请减少页数或降低分辨率后重试。",
}
