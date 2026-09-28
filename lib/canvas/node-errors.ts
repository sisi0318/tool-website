/**
 * 适配器报“没有选择文件”时抛这个码，界面按码显示当前语言。
 * 以前是英文原文 "No file provided"，导入工作流后（文件不随工作流保存）下游一律报这句英文。
 */
export const MISSING_FILE_ERROR = "canvas:missing-file"
