import type React from "react"
import type { Metadata, Viewport } from "next"
import { Roboto } from "next/font/google"
import "./globals.css"
import { M3ThemeProvider } from "@/lib/m3/theme"
import { I18nProvider } from "@/components/i18n-provider"

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
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
}

export const metadata: Metadata = {
  title: "工具站",
  description: "一个实用的在线工具集合",
  generator: 'v0.dev',
  manifest: "/manifest.json",
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
  params = { locale: "zh" },
}: {
  children: React.ReactNode
  params?: { locale?: string }
}) {
  const locale = params.locale || "zh"

  return (
    <html lang={locale} suppressHydrationWarning className={roboto.variable}>
      <body className={roboto.className}>
        <M3ThemeProvider defaultMode="system">
          <I18nProvider locale={locale}>
            <main>{children}</main>
          </I18nProvider>
        </M3ThemeProvider>
      </body>
    </html>
  )
}
