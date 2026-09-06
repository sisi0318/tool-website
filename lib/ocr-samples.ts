export type OcrSample = "document" | "small" | "dark" | "long"
export async function createOcrSample(kind: OcrSample): Promise<File> {
  const small = kind === "small", dark = kind === "dark", long = kind === "long"
  const canvas = document.createElement("canvas")
  canvas.width = small ? 640 : 1100; canvas.height = long ? 3000 : small ? 260 : 420
  const ctx = canvas.getContext("2d")!
  ctx.fillStyle = dark ? "#16251c" : "#ffffff"; ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = dark ? "#f6f6eb" : "#17291c"; ctx.textBaseline = "top"
  const font = '"Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", sans-serif'
  const lines = small ? ["小字测试：浏览器本地 OCR 识别", "订单编号：AB-2026-0906", "金额 1234.56 元，数量 28 件", "Email: test@example.com", "请核对数字 0O1l 和标点符号。"] : ["浏览器本地文字识别", "支持中文、English 与数字 0123456789", "图片不会上传，识别结果可以编辑。", "订单编号：OCR-2026-0906", "金额：1234.56 元  邮箱：hello@example.com", "Precision matters: 0O1l, [] {} / + ="]
  lines.forEach((line, i) => { ctx.font = `${small ? 14 : i === 0 ? 34 : 24}px ${font}`; ctx.fillText(line, small ? 24 : 48, (small ? 24 : 36) + i * (small ? 40 : 58)) })
  if (long) {
    ctx.font = `24px ${font}`
    for (let i = 1; i <= 30; i++) ctx.fillText(`长截图第 ${String(i).padStart(2, "0")} 行：订单 AB-${1000 + i}，数量 ${i} 件。`, 48, 490 + (i - 1) * 80)
  }
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("sample")), "image/png"))
  return new File([blob], `ocr-${kind}.png`, { type: "image/png" })
}
