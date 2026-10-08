/** 「imageRedact」的中文文案：只随用到它的页面加载，调用处写 useTranslations("imageRedact", zhImageRedact) */
export const zhImageRedact = {
  title: "图片隐私打码", description: "找出图片中的隐私信息，确认后遮住",
  upload: "选择图片", sample: "加载示例", clear: "清空", limits: "可拖入或粘贴 PNG / JPEG / WebP；最大 20 MB、2000 万像素。", firstFrame: "仅处理第一帧",
  kind_phone: "手机号 / 国际号码", kind_email: "邮箱", kind_identity: "中国大陆身份证号", detect: "检测敏感内容",
  detectHint: "检测依赖 OCR 和号码格式，可能漏检或误判。自动选区覆盖命中内容所在整行，请核对并补充姓名、头像、地址等区域。再次检测会替换自动选区，保留手动选区。",
  phase_prepare: "正在读取图片…", phase_detect: "正在检测…", phase_render: "正在生成图片…", cancel: "取消", cancelled: "已取消，现有选区仍保留。",
  detected: "找到 {count} 个候选区域，请逐项核对后生成图片。", noneDetected: "没有找到符合所选格式的内容，不代表图片没有隐私信息。请对照原图手动画框。",
  error: "图片处理失败，请检查图片或重试。", errorTimeout: "处理超时，请裁剪或缩小图片后重试。", regionLimit: "最多支持 2000 个选区，请先移除多余选区。",
  review: "核对原图与选区", zoom: "缩放", drawHint: "在图片上拖动即可画框。红色区域表示已选中；此处用于核对，生成结果后再下载。也可添加选区后用下方坐标微调。",
  sourcePreview: "原图与打码候选区域", manual: "添加手动选区", regions: "已选择区域", selectAll: "全选", selectNone: "全不选", undo: "撤销", empty: "先检测内容，或在左侧图片上手动画框。",
  selectRegion: "选择区域", deleteRegion: "删除区域", manualRegion: "手动选区", coordinates: "微调坐标（原图像素）", x: "左侧 X", y: "顶部 Y", width: "宽度", height: "高度",
  color: "覆盖颜色", black: "黑色", white: "白色", format: "导出格式", exportHint: "导出会用不透明纯色覆盖所有已选区域，并重新编码图片，不保留源文件的 EXIF 等元数据。未选中的区域保持可见；PNG 保留区域外的透明度，JPEG 铺白底。",
  apply: "确认选区并生成图片", result: "打码后的图片", download: "下载图片", resultPreview: "已将选区覆盖为纯色的图片", resultHint: "请核对整张结果图后再分享。改动选区、颜色或格式后，需要重新生成。下载仅包含合成后的图片。",
}
