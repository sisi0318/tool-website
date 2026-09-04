import type { Metadata } from "next"

import { SettingsContent } from "./settings-content"

export const metadata: Metadata = {
  title: "设置与本地数据",
  description: "查看本站在这台设备上存了哪些数据，并按类别或全部清除。",
  alternates: { canonical: "/settings" },
  // 纯本地状态页，没有可索引的内容
  robots: { index: false, follow: true },
}

export default function SettingsPage() {
  return <SettingsContent />
}
