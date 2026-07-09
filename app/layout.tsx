import type React from "react"
import type { Metadata, Viewport } from "next"
import { Roboto } from "next/font/google"
import "./globals.css"
import { M3ThemeProvider } from "@/lib/m3/theme"
import { I18nProvider } from "@/components/i18n-provider"
import { AppShell } from "@/components/app-shell"

/**
 * Configure Roboto font family as per M3 specifications
 * Google Sans is not available via next/font, so we use Roboto as the primary font
 * with Google Sans loaded via CSS for browsers that support it
 * 
 * Requirements: 2.2
 */
const roboto = Roboto({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  variable: "--font-roboto",
  display: "swap",
})

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FDFDF5" },
    { media: "(prefers-color-scheme: dark)", color: "#10140F" },
  ],
  colorScheme: "light dark",
  width: "device-width",
  initialScale: 1,
}

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "工具站",
    template: "%s | 工具站",
  },
  description: "无需安装、打开即用的在线工具集合，覆盖开发、文本、图片、编码与工作流处理。",
  applicationName: "工具站",
  manifest: "/manifest.json",
  openGraph: {
    title: "工具站 — 顺手完成每一件小事",
    description: "30+ 个开发、文本、图片与编码工具，无需安装，打开即用。",
    type: "website",
    locale: "zh_CN",
    images: [
      {
        url: "/og.png",
        width: 1731,
        height: 909,
        alt: "工具站 — 30+ 个无需安装、打开即用的实用工具",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "工具站 — 顺手完成每一件小事",
    description: "30+ 个开发、文本、图片与编码工具，无需安装，打开即用。",
    images: ["/og.png"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "工具站",
  },
  formatDetection: {
    telephone: false,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning className={roboto.variable}>
      <body className={roboto.className}>
        <M3ThemeProvider defaultMode="system">
          <I18nProvider locale="zh">
            <a href="#main-content" className="skip-link">跳到主要内容</a>
            <AppShell>{children}</AppShell>
          </I18nProvider>
        </M3ThemeProvider>
      </body>
    </html>
  )
}
