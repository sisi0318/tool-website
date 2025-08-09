import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { I18nProvider } from "@/components/i18n-provider"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "工具站",
  description: "一个实用的在线工具集合",
    generator: 'v0.dev'
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
    <html lang={locale} suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <I18nProvider locale={locale}>
            <main>{children}</main>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
