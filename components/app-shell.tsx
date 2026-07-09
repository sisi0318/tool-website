"use client"

import type { ReactNode } from "react"
import { usePathname } from "next/navigation"
import { BottomNav } from "@/components/bottom-nav"
import { cn } from "@/lib/utils"

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const isCanvas = pathname.startsWith("/canvas")

  return (
    <>
      <main id="main-content" className={cn("min-h-screen", !isCanvas && "pb-nav-mobile")}>{children}</main>
      {!isCanvas && <BottomNav />}
    </>
  )
}
