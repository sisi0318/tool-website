/** 「imageBatch」的中文文案：只随用到它的页面加载，调用处写 useTranslations("imageBatch", zhImageBatch) */
export const zhImageBatch = {
  confirmOptionChange: "修改参数会清空已完成的 {count} 项结果，手动校对过的文字也会丢失。", applyChange: "仍然修改", keepResults: "保留结果",
  title: "图片批量处理", description: "多张图片一起转文字、压缩或换格式",
  add: "添加图片", samples: "试试三张示例", dropHint: "支持多选、拖放或粘贴图片", clear: "清空队列", limits: "支持 PNG / JPEG / WebP，最多 30 张、合计 120 MB；单张最多 20 MB / 2000 万像素。输出合计最多 120 MB。动态图片仅处理首帧。",
  skippedType: "已跳过 {count} 个不是 PNG / JPEG / WebP 的文件。", skipped: "部分文件超过限制，未加入队列。每张最多 20 MB，队列最多 30 张 / 120 MB。", ocrMode: "批量 OCR", imageMode: "压缩与格式转换", format: "输出格式", quality: "质量（10–100）", width: "最大宽度（px）", height: "最大高度（px）", keepSize: "保持原尺寸",
  imageHint: "按比例缩小，不放大。JPEG 透明区域铺白，PNG / WebP 保留透明度。PNG 为无损编码，质量参数不适用；重新编码后文件也可能变大。",
  optionsHint: "修改参数会清除旧结果，所有图片将按新参数重新处理。", run: "处理待完成项", retry: "重试失败项", rerun: "重新处理全部", cancel: "取消", cancelled: "已取消。完成的结果已保留，可继续处理待完成项。",
  phase_run: "正在处理", phase_zip: "正在打包已完成结果", phase_sample: "正在准备示例", progress: "批量处理进度", queue: "任务队列", status_ready: "待处理", status_running: "处理中", status_done: "完成", status_error: "失败", remove: "移除",
  preview: "结果预览", previewEmpty: "点击队列中的文件，完成后在这里预览结果。", textHint: "可直接校对文本。TXT 使用编辑后的文字；JSON 同时保留原始识别框、置信度和校对文本。", smaller: "体积减少", larger: "体积增加",
  export: "导出已完成结果", zipHint: "ZIP 仅包含已完成文件，并附带完整队列清单。失败或未完成项会标明状态；同名结果自动编号。OCR 文本和 JSON 分别放在 text / data 文件夹。", pack: "生成 ZIP", downloadZip: "下载 ZIP", copyAll: "复制全部文本",
  error_fileLimit: "文件为空或超过 20 MB。", error_queueLimit: "队列超过 30 张或 120 MB，请分批处理。", error_options: "请检查质量与尺寸参数：质量为 10–100，尺寸为 1–32768，留空保持原尺寸。", error_outputLimit: "结果超过单份 64 MB 或合计 120 MB，请缩小尺寸或减少文件。", error_unsupported: "浏览器不支持所选的图像处理方式，请更换格式或使用较新的浏览器。", error_convert: "处理失败，请检查文件是否完整后重试。", error_cancelled: "已取消。", error_timeout: "单张图片处理超时，请缩小图片后重试。",
}
