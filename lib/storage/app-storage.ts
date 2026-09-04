import { removeLocalStorage } from "../safe-storage"

/**
 * 本站在浏览器里存了什么 —— 单一清单。
 *
 * 此前这些键散落在十来个文件里各自定义，没有任何地方能回答「这个站在我机器上
 * 留了些什么」，也没有清除入口。其中画布配置与 TOTP 账户是明文保存的长期凭据，
 * 用户至少应当能看见并删掉它们。
 *
 * 新增持久化数据时请在这里登记，lib/storage/app-storage.test.ts 会检查
 * 代码里出现的存储键都已登记。
 */

export type StorageGroupId = "workspace" | "canvas" | "journey" | "tools" | "preferences"

export interface StorageEntry {
  /** 固定键名 */
  key?: string
  /** 前缀型键（如每个已保存工作流一个键） */
  prefix?: string
  group: StorageGroupId
  /** i18n 键，说明这条存了什么 */
  descriptionKey: string
  /** 含长期凭据或个人数据，界面上要单独标出 */
  sensitive?: boolean
}

export const STORAGE_ENTRIES: readonly StorageEntry[] = [
  // 工作台
  { key: "tool_tabs_state", group: "workspace", descriptionKey: "storageTabs" },
  { key: "tool_active_tab", group: "workspace", descriptionKey: "storageTabs" },
  { key: "tool_favorite_ids", group: "workspace", descriptionKey: "storageFavorites" },
  { key: "tool_recent_ids", group: "workspace", descriptionKey: "storageRecents" },

  // 画布
  {
    key: "canvas-state",
    group: "canvas",
    descriptionKey: "storageCanvasState",
    // 节点配置里可能有加解密密钥、Authorization 头等
    sensitive: true,
  },
  { key: "canvas-workflow-list", group: "canvas", descriptionKey: "storageCanvasWorkflows" },
  {
    prefix: "WORKFLOW_",
    group: "canvas",
    descriptionKey: "storageCanvasWorkflows",
    sensitive: true,
  },
  { key: "canvas-favorite-nodes", group: "canvas", descriptionKey: "storageCanvasNodePrefs" },
  { key: "canvas-recent-nodes", group: "canvas", descriptionKey: "storageCanvasNodePrefs" },

  // 数据旅程
  { key: "journey-draft", group: "journey", descriptionKey: "storageJourneyDraft", sensitive: true },
  { key: "journey-saves", group: "journey", descriptionKey: "storageJourneySaves", sensitive: true },

  // 各工具
  { key: "totp_accounts", group: "tools", descriptionKey: "storageTotp", sensitive: true },
  { key: "http_tester_templates", group: "tools", descriptionKey: "storageHttpTemplates", sensitive: true },
  { key: "device-info-ip-cache", group: "tools", descriptionKey: "storageDeviceIp", sensitive: true },
  { key: "device-info-ip-cache-enabled", group: "tools", descriptionKey: "storageDeviceIpPref" },
  { key: "currency_rates_all", group: "tools", descriptionKey: "storageCurrencyRates" },
  { key: "currency-rates-cache", group: "tools", descriptionKey: "storageCurrencyRates" },
  { key: "currency_selected_currencies", group: "tools", descriptionKey: "storageCurrencyPrefs" },
  { key: "currency_multi_currencies", group: "tools", descriptionKey: "storageCurrencyPrefs" },
  { key: "currency_active_tab", group: "tools", descriptionKey: "storageCurrencyPrefs" },
  { key: "time_world_clocks", group: "tools", descriptionKey: "storageTimeClocks" },
  { key: "time_format", group: "tools", descriptionKey: "storageTimePrefs" },
  { key: "time_date_format", group: "tools", descriptionKey: "storageTimePrefs" },
  { key: "time_show_seconds", group: "tools", descriptionKey: "storageTimePrefs" },
  { key: "time_active_tab", group: "tools", descriptionKey: "storageTimePrefs" },

  // 全站偏好
  { key: "locale", group: "preferences", descriptionKey: "storageLocale" },
  { key: "theme", group: "preferences", descriptionKey: "storageTheme" },
]

export const STORAGE_GROUPS: readonly StorageGroupId[] = [
  "workspace",
  "canvas",
  "journey",
  "tools",
  "preferences",
]

/** 某个实际存在的键属于哪条登记项 */
function matchEntry(key: string): StorageEntry | undefined {
  return STORAGE_ENTRIES.find(
    (entry) => entry.key === key || (entry.prefix !== undefined && key.startsWith(entry.prefix)),
  )
}

export interface StorageGroupUsage {
  group: StorageGroupId
  /** 实际存在的键 */
  keys: string[]
  /** 粗略字节数（键 + 值的 UTF-16 长度，够用于展示量级） */
  bytes: number
  /** 该组是否含敏感数据 */
  sensitive: boolean
}

function listOwnedKeys(): string[] {
  if (typeof window === "undefined") return []
  try {
    const keys: string[] = []
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index)
      if (key && matchEntry(key)) keys.push(key)
    }
    return keys
  } catch {
    return []
  }
}

export function readStorageUsage(): StorageGroupUsage[] {
  const usage = new Map<StorageGroupId, StorageGroupUsage>()

  for (const key of listOwnedKeys()) {
    const entry = matchEntry(key)
    if (!entry) continue
    let value = ""
    try {
      value = window.localStorage.getItem(key) ?? ""
    } catch {
      // 读不到就按 0 计，不影响清除
    }
    const current =
      usage.get(entry.group) ?? { group: entry.group, keys: [], bytes: 0, sensitive: false }
    current.keys.push(key)
    // UTF-16 code unit ≈ 2 字节，浏览器配额也是按这个口径算的
    current.bytes += (key.length + value.length) * 2
    current.sensitive = current.sensitive || entry.sensitive === true
    usage.set(entry.group, current)
  }

  return STORAGE_GROUPS.map((group) => usage.get(group)).filter(
    (item): item is StorageGroupUsage => item !== undefined,
  )
}

/**
 * 清除本站写入的数据。只删登记过的键，不碰同域下的其它内容。
 *
 * @param groups 不传则清除全部
 * @returns 实际删除的键数量
 */
export function clearAppStorage(groups?: readonly StorageGroupId[]): number {
  const wanted = groups ? new Set(groups) : null
  let removed = 0

  for (const key of listOwnedKeys()) {
    const entry = matchEntry(key)
    if (!entry) continue
    if (wanted && !wanted.has(entry.group)) continue
    if (removeLocalStorage(key)) removed += 1
  }

  return removed
}

export function formatStorageSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
