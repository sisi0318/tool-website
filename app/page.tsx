"use client"

import type React from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"

import { useTranslations } from "@/hooks/use-translations"

export default function HomePage() {
  const t = useTranslations("home")

  return (
    <div className="min-h-screen bg-[var(--md-sys-color-surface)] relative overflow-hidden">
      {/* Animated Background Blobs - M3 Expressive */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div 
          className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full opacity-30
            bg-gradient-to-br from-[var(--md-sys-color-primary-container)] to-[var(--md-sys-color-tertiary-container)]
            blur-3xl animate-pulse"
          style={{ animationDuration: '4s' }}
        />
        <div 
          className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full opacity-25
            bg-gradient-to-tr from-[var(--md-sys-color-secondary-container)] to-[var(--md-sys-color-primary-container)]
            blur-3xl animate-pulse"
          style={{ animationDuration: '5s', animationDelay: '1s' }}
        />
        <div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full opacity-20
            bg-gradient-to-r from-[var(--md-sys-color-tertiary-container)] to-[var(--md-sys-color-secondary-container)]
            blur-3xl animate-pulse"
          style={{ animationDuration: '6s', animationDelay: '2s' }}
        />
      </div>

      {/* Hero Section */}
      <div className="container mx-auto px-4 sm:px-6 py-12 sm:py-20 md:py-28 relative z-10">
        <div className="max-w-5xl mx-auto text-center">
          {/* Main Title with Gradient */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 sm:mb-8
            text-gradient-animated leading-tight
          ">
            {t("title")}
          </h1>
          
          {/* Description */}
          <p className="text-lg sm:text-xl md:text-2xl text-[var(--md-sys-color-on-surface-variant)] 
            mb-8 sm:mb-10 max-w-3xl mx-auto leading-relaxed px-4
          ">
            {t("description")}
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center px-4">
            <Link href="/tools" className="w-full sm:w-auto">
              <Button 
                size="lg" 
                className="w-full sm:w-auto text-base sm:text-lg px-8 sm:px-10 py-6 sm:py-7 btn-gradient
                  gap-3 font-semibold touch-target
                "
              >
                {t("exploreTools")}
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Bottom Wave Effect */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[var(--md-sys-color-surface-container)] to-transparent pointer-events-none" />
    </div>
  )
}
