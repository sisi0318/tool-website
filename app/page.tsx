"use client"

import type React from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"

import { useTranslations } from "@/hooks/use-translations"

export default function HomePage() {
  const t = useTranslations("home")

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Hero Section */}
      <div className="container mx-auto mobile-px mobile-py md:py-20">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="hero-title text-5xl md:text-7xl font-bold tracking-tight mb-6 text-gradient">
            {t("title")}
          </h1>
          <p className="text-lg md:text-xl lg:text-2xl text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto leading-relaxed">
            {t("description")}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link href="/tools" className="w-full sm:w-auto">
              <Button size="lg" className="mobile-btn sm:w-auto text-lg px-8 py-6 btn-gradient touch-target">
                {t("exploreTools")}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}