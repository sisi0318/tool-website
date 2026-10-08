/** 「compressionFiles」的中文文案：只随用到它的页面加载，调用处写 useTranslations("compressionFiles", zhCompressionFiles) */
export const zhCompressionFiles = {
  exampleFiles: "添加示例文件", exampleFile: "载入示例文件", exampleZip: "载入示例 ZIP", reverseResult: "用结果反向处理",
  title: "文件压缩与 ZIP", description: "查看压缩包、提取文件，也能打包文件",
  panelMode: "工作模式", filesMode: "文件 / ZIP", textMode: "编码文本", browseZip: "浏览 ZIP", createZip: "打包 ZIP", fileCodec: "文件压缩 / 解压",
  dropZip: "拖入 ZIP 文件，先浏览目录", zipLimit: "归档输入最大 64 MB，最多 2,000 项；每项提取最大 64 MB。", chooseZip: "打开 ZIP",
  nameEncoding: "文件名编码", autoNames: "自动（UTF-8 / CP437）", archiveSize: "归档大小", unpackedSize: "原始大小", entries: "项", files: "个文件",
  rootFolder: "根目录", parent: "上一级", searchFiles: "搜索当前目录…", selectScope: "选择当前范围", selected: "项已选", selectFile: "选择",
  extractSelected: "提取所选", extracting: "正在提取", bundleSelected: "所选项打包为 ZIP", extractedFiles: "已提取文件", path: "路径", preview: "预览", previewFile: "预览", emptyFolder: "此目录为空或没有匹配文件。",
  dropFiles: "拖入要打包的文件，或选择文件夹保留层级", chooseFiles: "添加文件", chooseFolder: "添加文件夹", packHelp: "最多 2,000 项，每个文件最大 64 MB、总输入最大 128 MB；下方可编辑压缩包内路径。",
  zipFilename: "ZIP 文件名", level: "压缩级别", storeOnly: "仅打包（0）", fast: "快速（1）", balanced: "均衡（6）", smallest: "高压缩（9）", packing: "正在打包", archivePath: "压缩包内路径", removeFile: "移除",
  fileCodecHelp: "文件直接以二进制处理。支持 GZip、Zlib、Deflate 和 Brotli，输入最大 64 MB，输出最大 128 MB。", chooseSourceFile: "选择源文件", operation: "操作", format: "格式", compress: "压缩", decompress: "解压",
  processing: "正在处理…", cancel: "取消", clear: "清空", downloadFile: "下载文件", previewMode: "预览格式", loading: "正在读取预览…", emptyFile: "空文件", notText: "这段数据不是可打印的 UTF-8 文本，可切换到 Hex 查看。", previewHelp: "文本预览前 64 KB，Hex 预览前 512 字节；下载和继续处理使用完整文件。",
  errors: { invalidZip: "无法读取 ZIP 目录，文件可能不完整或已损坏。", unsupportedZip: "暂不支持分卷或加密目录的 ZIP。", encrypted: "此项已加密，暂不支持提取。", unsupportedMethod: "此项的压缩方法暂不支持。", unsafePath: "此路径不安全、过长，或目录项包含文件内容。", duplicatePath: "压缩包中存在重复路径或文件与目录冲突，请修改路径。", notFound: "没有找到指定 ZIP 文件。", inputLimit: "超出输入限制：单文件或归档最大 64 MB，打包总输入最大 128 MB。", outputLimit: "解压数据超过限制：单项最大 64 MB，单次合计最大 128 MB。", entryLimit: "文件项数量超过 2,000。", corrupt: "数据或校验值不匹配，文件可能已损坏。", nameEncoding: "无法按此编码读取文件名，请选择其他编码。", cancelled: "已取消处理。", invalidInput: "请提供有效文件和处理参数。", formatRequired: "无法识别压缩格式，请手动选择。", entryRequired: "ZIP 包含多个文件，请指定条目路径或序号。" },
}
