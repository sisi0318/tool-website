/**
 * 中文文案。站点主语言，随首屏一起加载。
 *
 * 此前中英文放在同一个 280KB 的文件里，整包进根布局的共享 chunk，
 * 每个访客都要下载两种语言。现在按语言拆开，英文由 i18n-provider 按需加载。
 *
 * 这里只留每个页面都用到的公共部分；各页面自己的文案在 zh-namespaces/ 下，
 * 随页面模块加载，调用处把它传给 useTranslations(命名空间, 文案)。
 */
export const zh = {
common: {
  copyImage: "复制图片",
  imageCopied: "图片已复制，可以直接粘贴",
  copyImageFailedHint: "这个浏览器不允许把图片写进剪贴板，请下载后再上传。",
  copyFailed: "复制失败",
  copyFailedHint: "浏览器没有允许写入剪贴板。请选中内容后按 Ctrl+C（⌘+C）复制。",
  siteName: "工具站",
  home: "首页",
  tools: "工具",
  canvas: "工具画布",
  allTools: "所有工具",
  toggleTheme: "切换主题",
  switchLanguage: "切换语言",
  backToTools: "返回工具列表",
  copyToolLink: "复制工具链接",
  linkCopied: "链接已复制",
  openInWorkspace: "在工作台打开",
  focusInputHint: "按 / 定位输入框",
  errorTitle: "页面出错了",
  errorDescription: "刚才的操作遇到了意外错误。你可以重试，或返回首页继续使用其他工具。",
  errorRetry: "重试",
  errorBackHome: "返回首页",
  notFoundTitle: "页面不存在",
  notFoundDescription: "你访问的地址不存在或已被移除。可以回到首页，或浏览全部工具。",
  notFoundBrowseTools: "浏览全部工具",
  journey: "数据旅程",
  settings: "设置",
  searchTools: "搜索工具",
  runningInBackground: "正在处理",
  undo: "撤销",
  redo: "重做",
  inputCleared: "已清空输入",
  inputReplacedBySample: "输入已换成示例",
  inputReplacedByResult: "结果已填入输入框",
  replaceFile: "更换文件",
  openFile: "打开文件",
  openFileFailed: "无法打开文件",
  textFileTooLarge: "文件超过 {size}，请选择较小的文件。",
  notTextFile: "这不是 UTF-8 或 UTF-16 编码的文本文件。",
  inputReplacedByFile: "输入已换成文件内容",
  inputReplacedByTransfer: "输入已换成传入的数据",
  errorAt: "第 {line} 行，第 {column} 列",
  errorAtLine: "第 {line} 行",
  revealError: "定位",
  filesSkipped: "已跳过 {count} 个文件",
  skippedType: "格式不支持",
  skippedSize: "超过 {size}",
},
commandPalette: {
  title: "搜索工具", placeholder: "搜索工具或功能…", favorites: "收藏", recents: "最近使用",
  noResults: "没有找到匹配的工具", emptyHint: "输入工具名、功能或英文关键词", hint: "↑↓ 选择，Enter 打开，Esc 关闭",
},
tools: {
  harTools: { name: "HAR 网络日志分析", description: "查看网页加载记录，找出慢在哪里" },
  imageDiff: { name: "图片对比", description: "对照两张图片，标出不同之处" },
  imageTable: { name: "截图表格识别", description: "把截图里的表格转成可编辑表格" },
  imageRedact: { name: "图片隐私打码", description: "找出图片中的隐私信息，确认后遮住" },
  imageBatch: { name: "图片批处理", description: "多张图片一起转文字、压缩或换格式" },
  ocr: { name: "OCR 文字识别", description: "提取图片和扫描件文字，导出可搜索文档" },
  imageToSvg: { name: "图片转 SVG", description: "把图片转成可放大不模糊的图形" },
  pageTitle: "工具集",
  eyebrow: "随取随用的工作台",
  intro: "搜索功能，或从下方选择一个工具开始。你打开的工具会保留在标签页中，方便并行处理。",
  countSuffix: "个工具",
  noResults: "没有找到相关工具，试试更短的关键词。",
  clearSearch: "清除搜索",
  close: "关闭",
  openTool: "打开工具",
  addTool: "添加工具",
  tabClosed: "已关闭“{name}”",
  toolCrashedTitle: "“{name}”出错了",
  toolCrashedDescription: "这个工具遇到了意外错误，其它标签不受影响。可以重试，或者在独立页里打开。",
  toolChunkFailed: "工具的文件没能加载，网站可能刚更新过。刷新页面后再试。",
  retryTool: "重试",
  reloadPage: "刷新页面",
  openStandalone: "在独立页打开",
  closeTab: "关闭标签",
  moreOptions: "更多选项",
  favorites: "收藏工具",
  recentTools: "最近使用",
  quickAccess: "快捷启动",
  allTools: "全部工具",
  addFavorite: "添加到收藏",
  removeFavorite: "取消收藏",
  favoriteHint: "点击星标固定常用工具",
  categories: {
    all: "全部",
    developer: "开发工具",
    security: "安全加密",
    image: "图片处理",
    text: "文本文档",
    network: "网络",
    life: "生活实用",
  },
  search: {
    placeholder: "搜索工具...",
  },
  copyLink: "复制链接",
  linkCopied: "链接已复制",
  hash: {
    name: "哈希计算器",
  },
  crypto: {
    name: "加密解密工具",
  },
  encoding: {
    name: "编码解码工具",
  },
  classicCipher: {
    name: "经典密码",
  },
  hmac: {
    name: "HMAC计算器",
  },
  currency: {
    name: "汇率转换",
  },
  time: {
    name: "时间工具",
  },
  qrcode: {
    name: "二维码生成器",
  },
  json: {
    name: "JSON工具",
  },
  color: {
    name: "颜色选择器",
  },
  device: {
    name: "设备信息",
  },
  protobuf: {
    name: "Protobuf 解析器",
  },
  baseConverter: {
    name: "进制转换器",
  },
  temperatureConverter: {
    name: "温度转换器",
  },
  dockerConverter: {
    name: "Docker转换器",
  },
  crontab: {
    name: "Crontab表达式生成器",
  },
  imageToBase64: {
    name: "图片转Base64",
  },
  exifViewer: {
    name: "图片EXIF查看器",
  },
  bmi: {
    name: "BMI计算器",
  },
  regex: {
    name: "正则表达式测试",
  },
  qrcodeDecoder: {
    name: "二维码解码器",
  },
  httpTester: {
    name: "http请求测试",
  },
  whois: {
    name: "WHOIS查询",
  },
  uuid: {
    name: "UUID生成器",
  },
  passwordGenerator: {
    name: "密码生成器",
  },
  jwt: {
    name: "JWT解析器",
  },
  textStats: {
    name: "文本统计",
  },
  imageCompress: {
    name: "图片压缩",
  },
  imageConvert: {
    name: "图片格式转换",
  },
  imageEditor: {
    name: "图片编辑器",
  },
  officeViewer: {
    name: "Office预览",
  },
  memeSplitter: {
    name: "智能切图",
  },
  imageCoordinates: {
    name: "坐标拾取",
  },
  caseConverter: {
    name: "大小写转换",
  },
  totp: {
    name: "TOTP验证器",
  },
  jce: {
    name: "JCE 解析器",
  },
  diff: {
    name: "文本 / 结构化对比",
  },
  dataDetector: { name: "智能数据识别" },
  compression: { name: "压缩与解压" },
  xmlTools: { name: "XML 工具" },
  csvTools: { name: "CSV / JSONL 工具" },
  unicodeTools: { name: "Unicode 字符检查" },
  textLinesTools: { name: "文本行处理" },
  urlTools: { name: "URL 参数编辑" },
  binaryCodecTools: { name: "MessagePack / CBOR" },
  sqliteTools: { name: "SQLite 文件查看" },
  pdfTools: { name: "PDF 页面工具" },
  markdownTools: { name: "Markdown 工具" },
  sqlTools: { name: "SQL 格式化" },
  jsonSchemaTools: { name: "JSON Schema" },
  subnetTools: { name: "IP / CIDR 计算器" },
  certificateTools: { name: "证书与密钥查看" },
  hexBinaryTools: { name: "Hex / 二进制查看" },
},
toolTransfer: {
  continue: "继续处理", journey: "在数据旅程中继续", chooseTool: "在数据旅程中选下一步…",
  openInTool: "在工具中打开…", openInToolTitle: "在工具中打开", openInToolDescription: "只列出能接收这份数据的工具。", searchTools: "搜索工具", noCompatibleTools: "没有匹配的工具",
  journeyOpenedInNewTab: "已在新标签页打开数据旅程，工作台保持原样", transferExpired: "传入的数据已失效，请回到原工具重新发送。",
  tooLarge: "数据过大，最多传递 64 MB 文件或 8M 字符文本。", invalidValue: "此结果无法传递，请先转为文本、JSON 或文件。", failed: "未能传递数据，请重试。",
  received: "接收到工具输出", draftConflict: "当前有尚未保存的旅程草稿。开始新旅程会用传入数据替换草稿；也可以返回原旅程继续处理或先保存。",
  startNew: "用传入数据开始新旅程", restoreDraft: "返回原旅程",
},
utilityWorkbench: {
  staleOutput: "输入或操作已改动，下面是上一次的结果。按 Ctrl+Enter（⌘+Enter）或点击运行更新。",
  autoRunPaused: "输入较长，已暂停自动运行；按 Ctrl+Enter（⌘+Enter）运行。",
  inputSettings: "输入与设置",
  operation: "操作",
  input: "输入",
  characters: "{count} 个字符",
  inputPlaceholder: "粘贴或输入内容...",
  processing: "处理中...",
  run: "开始处理",
  sample: "填入示例",
  clear: "清空",
  output: "输出",
  copy: "复制",
  copied: "已复制",
  copyFailed: "复制失败，请检查剪贴板权限",
  outputPlaceholder: "处理结果会显示在这里",
},
}
