/** 「imageDiff」的中文文案：只随用到它的页面加载，调用处写 useTranslations("imageDiff", zhImageDiff) */
export const zhImageDiff = {
  title: "图片对比", description: "对照两张图片，标出不同之处",
  a: "图片 A · 基准", b: "图片 B · 对照", uploadA: "选择图片 A", uploadB: "选择图片 B", choose: "选择图片", previewA: "图片 A 预览", previewB: "图片 B 预览", dropHint: "选择图片，或拖放 / 粘贴到此区域", sample: "加载对比示例", swap: "交换 A / B", clear: "清空", cancel: "取消",
  limits: "支持 PNG / JPEG / WebP，每张最大 20 MB、2000 万像素。对齐后的画布最多 2000 万像素、边长 32768；动态图片仅处理第一帧。", alignment: "对齐方式", topLeft: "左上角对齐", center: "居中对齐", offsetX: "B 水平偏移（px）", offsetY: "B 垂直偏移（px）", threshold: "忽略色差阈值", compare: "开始对比",
  optionsHint: "按原始像素尺寸比较，不缩放图片。偏移为正时，B 向右 / 向下移动；交换图片会清零偏移。阈值 0–255，越高越容易忽略轻微色差。透明度变化也计入差异，全透明像素的隐藏颜色不计；只有一张图覆盖的区域始终算差异。修改参数后需重新对比。",
  stage_prepare: "正在读取图片…", stage_readingA: "正在读取图片 A…", stage_readingB: "正在读取图片 B…", stage_comparing: "正在比较像素…", stage_encoding: "正在生成差异图片…", imageLimit: "图片或对齐后的画布超过 2000 万像素 / 边长 32768，请缩小图片或减少偏移。", optionsError: "阈值需为 0–255 整数，偏移需为 -32768 至 32768 的整数。", timeout: "图片对比超时，请缩小图片后重试。", error: "图片对比失败，请检查图片或重试。",
  result: "对比结果", changed: "差异像素", compared: "参与比较的像素", onlyA: "仅 A 覆盖", onlyB: "仅 B 覆盖", wipe: "滑动对照", overlay: "透明叠加", difference: "差异高亮", zoom: "缩放", position: "分隔位置", opacity: "B 不透明度", comparisonPreview: "图片对比预览",
  wipeHint: "左侧显示 A，右侧显示 B；拖动图片或使用滑块移动分隔线。", overlayHint: "A 位于底层，调节 B 的不透明度查看位置与内容变化。", diffHint: "红色是差异区域，浅灰原图仅作位置参考。PNG 导出使用完整分辨率的差异高亮图。", identical: "当前阈值下未发现差异。", bounds: "差异范围（对比画布像素）：", download: "下载差异 PNG", report: "下载统计 JSON",
}
