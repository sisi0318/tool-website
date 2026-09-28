/** 「dataDetector」的中文文案：只随用到它的页面加载，调用处写 useTranslations("dataDetector", zhDataDetector) */
export const zhDataDetector = {
  title: "智能数据识别",
  description: "自动判断输入内容的格式，并给出可继续处理的工具建议。",
  detect: "开始识别",
  placeholder: "粘贴 JSON、JWT、Base64、XML、UUID、时间戳或其他数据...",
  result: "识别结果",
  openTool: "继续处理",
  types: {
    json: "JSON",
    jwt: "JWT",
    base64: "Base64",
    hex: "十六进制",
    "url-encoded": "URL 编码",
    xml: "XML",
    timestamp: "Unix 时间戳",
    pem: "PEM",
    csv: "分隔文本",
    uuid: "UUID",
    gzip: "GZip",
    zip: "ZIP",
    "plain-text": "纯文本",
  },
}
