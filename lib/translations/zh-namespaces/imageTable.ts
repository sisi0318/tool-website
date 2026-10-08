/** 「imageTable」的中文文案：只随用到它的页面加载，调用处写 useTranslations("imageTable", zhImageTable) */
export const zhImageTable = {
  title: "截图表格识别", description: "把截图里的表格转成可编辑表格",
  upload: "选择图片", sample: "加载表格示例", clear: "清空", recognize: "识别表格", cancel: "取消", limits: "支持拖入、粘贴 PNG / JPEG / WebP，最大 20 MB、2000 万像素；表格最多 200 行、40 列、2000 个单元格。",
  phase_prepare: "读取图片与网格线…", phase_recognize: "识别表格文字…", phase_export: "正在导出…", error: "处理失败，请检查图片或重试。", limitError: "表格超出限制：最多 200 行、40 列、2000 格，每格 32767 字符，合计 200 万字符。请裁剪或拆分表格。",
  rulesFound: "已按可见网格线恢复行列，请核对文字与空白格。", inferred: "已按文字位置推测行列，无边框或合并单元格可能需要调整分隔线。", rebuilt: "已按当前分隔线重新分配原始识别文字。",
  structure: "原图与表格结构", zoom: "缩放", preview: "表格原图", boundaries: "可拖动的行列分隔线", xEdges: "列边界 X（逗号分隔）", yEdges: "行边界 Y（逗号分隔）",
  gridHint: "拖动蓝色分隔线，或编辑原图像素坐标；第一项和最后一项是表格外边界。增加或删除坐标可增减行列。应用后会重新分配原始文字，并覆盖已有的单元格编辑。倾斜、多表格、合并单元格请先裁剪，并手动核对。",
  gridError: "边界需递增、相邻至少 2 像素，且位于图片内；至少两项，并符合行列数量限制。", rebuild: "应用分隔线并重新分配文字", resetGrid: "恢复当前表格分隔线", changed: "分隔线已改动，请应用或恢复后再编辑、导出。",
  review: "校对单元格", reviewHint: "点击单元格对照原图高亮区域，可直接修改文字。橙色表示低置信度或文字跨越边界，编辑后会清除标记。识别不会自动恢复合并关系或原表格式。再次识别会覆盖当前表格。", reviewCount: "{count} 格需重点核对。", outside: "表格范围外有 {count} 行文字，未纳入导出。", row: "行号", cell: "单元格", needsReview: "需核对：低置信度或文字跨格",
  numbers: "Excel：将普通数字转为数值", safeCsv: "CSV：防止公式自动执行", exportHint: "Excel 默认按文本保留原文、前导零、长编号与多行内容。启用数值后只转换无前导零且不超过 15 位的普通数字。CSV 防护会在 =、+、-、@ 开头的内容前加单引号；直接用 Excel 打开 CSV 仍可能自动转换编号，需精确保留请下载 Excel。",
  xlsx: "生成 Excel", csv: "生成 CSV", download: "下载",
}
