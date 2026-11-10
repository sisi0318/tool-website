import type { Config } from "tailwindcss"
import { tokenColor } from "./lib/m3/tailwind-color"

const config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
    "*.{js,ts,jsx,tsx,mdx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        // Legacy shadcn/ui compatibility colors
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },

        // ============================================
        // Material You 3 EXPRESSIVE Color Tokens
        // ============================================
        // Declared through tokenColor() so that opacity modifiers work on them
        // (`bg-md-primary/90`). See lib/m3/tailwind-color.ts.
        
        // M3 Primary colors
        "md-primary": tokenColor("primary"),
        "md-on-primary": tokenColor("on-primary"),
        "md-primary-container": tokenColor("primary-container"),
        "md-on-primary-container": tokenColor("on-primary-container"),
        
        // M3 Secondary colors
        "md-secondary": tokenColor("secondary"),
        "md-on-secondary": tokenColor("on-secondary"),
        "md-secondary-container": tokenColor("secondary-container"),
        "md-on-secondary-container": tokenColor("on-secondary-container"),
        
        // M3 Tertiary colors
        "md-tertiary": tokenColor("tertiary"),
        "md-on-tertiary": tokenColor("on-tertiary"),
        "md-tertiary-container": tokenColor("tertiary-container"),
        "md-on-tertiary-container": tokenColor("on-tertiary-container"),
        
        // M3 Error colors
        "md-error": tokenColor("error"),
        "md-on-error": tokenColor("on-error"),
        "md-error-container": tokenColor("error-container"),
        "md-on-error-container": tokenColor("on-error-container"),

        // M3 Success colors (Expressive)
        "md-success": tokenColor("success"),
        "md-on-success": tokenColor("on-success"),
        "md-success-container": tokenColor("success-container"),
        "md-on-success-container": tokenColor("on-success-container"),

        // M3 Warning colors (Expressive)
        "md-warning": tokenColor("warning"),
        "md-on-warning": tokenColor("on-warning"),
        "md-warning-container": tokenColor("warning-container"),
        "md-on-warning-container": tokenColor("on-warning-container"),
        
        // M3 Surface colors
        "md-surface": tokenColor("surface"),
        "md-on-surface": tokenColor("on-surface"),
        "md-surface-variant": tokenColor("surface-variant"),
        "md-on-surface-variant": tokenColor("on-surface-variant"),
        "md-surface-dim": tokenColor("surface-dim"),
        "md-surface-bright": tokenColor("surface-bright"),
        "md-surface-container-lowest": tokenColor("surface-container-lowest"),
        "md-surface-container-low": tokenColor("surface-container-low"),
        "md-surface-container": tokenColor("surface-container"),
        "md-surface-container-high": tokenColor("surface-container-high"),
        "md-surface-container-highest": tokenColor("surface-container-highest"),

        // M3 state layers, named so the two opacities live in one place:
        // `hover:bg-md-hover`, `active:bg-md-pressed`.
        "md-hover": "color-mix(in srgb, var(--md-sys-color-on-surface) 8%, transparent)",
        "md-pressed": "color-mix(in srgb, var(--md-sys-color-on-surface) 12%, transparent)",
        
        // M3 Outline colors
        "md-outline": tokenColor("outline"),
        "md-outline-variant": tokenColor("outline-variant"),
        
        // M3 Other colors
        "md-shadow": tokenColor("shadow"),
        "md-scrim": tokenColor("scrim"),
        "md-inverse-surface": tokenColor("inverse-surface"),
        "md-inverse-on-surface": tokenColor("inverse-on-surface"),
        "md-inverse-primary": tokenColor("inverse-primary"),
      },
      borderRadius: {
        // Legacy shadcn/ui compatibility
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        
        // ============================================
        // M3 EXPRESSIVE Shape Tokens (larger radii)
        // ============================================
        "md-xs": "var(--md-sys-shape-corner-extra-small)",
        "md-sm": "var(--md-sys-shape-corner-small)",
        "md-md": "var(--md-sys-shape-corner-medium)",
        "md-lg": "var(--md-sys-shape-corner-large)",
        "md-xl": "var(--md-sys-shape-corner-extra-large)",
        "md-full": "var(--md-sys-shape-corner-full)",
      },
      transitionDuration: {
        // ============================================
        // M3 Motion Duration Tokens
        // ============================================
        "md-short-1": "var(--md-sys-motion-duration-short1)",
        "md-short-2": "var(--md-sys-motion-duration-short2)",
        "md-short-3": "var(--md-sys-motion-duration-short3)",
        "md-short-4": "var(--md-sys-motion-duration-short4)",
        "md-medium-1": "var(--md-sys-motion-duration-medium1)",
        "md-medium-2": "var(--md-sys-motion-duration-medium2)",
        "md-medium-3": "var(--md-sys-motion-duration-medium3)",
        "md-medium-4": "var(--md-sys-motion-duration-medium4)",
        "md-long-1": "var(--md-sys-motion-duration-long1)",
        "md-long-2": "var(--md-sys-motion-duration-long2)",
        "md-long-3": "var(--md-sys-motion-duration-long3)",
        "md-long-4": "var(--md-sys-motion-duration-long4)",
        "md-extra-long-1": "var(--md-sys-motion-duration-extra-long1)",
        "md-extra-long-2": "var(--md-sys-motion-duration-extra-long2)",
        "md-extra-long-3": "var(--md-sys-motion-duration-extra-long3)",
        "md-extra-long-4": "var(--md-sys-motion-duration-extra-long4)",
      },
      transitionTimingFunction: {
        // ============================================
        // M3 EXPRESSIVE Motion Easing Tokens
        // ============================================
        "md-standard": "var(--md-sys-motion-easing-standard)",
        "md-standard-decelerate": "var(--md-sys-motion-easing-standard-decelerate)",
        "md-standard-accelerate": "var(--md-sys-motion-easing-standard-accelerate)",
        "md-emphasized": "var(--md-sys-motion-easing-emphasized)",
        "md-emphasized-decelerate": "var(--md-sys-motion-easing-emphasized-decelerate)",
        "md-emphasized-accelerate": "var(--md-sys-motion-easing-emphasized-accelerate)",
        // Expressive spring-like easing
        "md-expressive": "var(--md-sys-motion-easing-expressive)",
        "md-expressive-decelerate": "var(--md-sys-motion-easing-expressive-decelerate)",
        "md-bounce": "var(--md-sys-motion-easing-bounce)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        // M3 Ripple effect animation (GPU-accelerated)
        "ripple": {
          "0%": { 
            transform: "scale(0)",
            opacity: "0.12",
          },
          "100%": { 
            transform: "scale(1)",
            opacity: "0",
          },
        },
        // GPU-accelerated scale animations
        "m3-scale-in": {
          "0%": { transform: "scale(0)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "m3-scale-out": {
          "0%": { transform: "scale(1)", opacity: "1" },
          "100%": { transform: "scale(0)", opacity: "0" },
        },
        // GPU-accelerated fade animations
        "m3-fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "m3-fade-out": {
          "0%": { opacity: "1" },
          "100%": { opacity: "0" },
        },
        // GPU-accelerated slide animations
        "m3-slide-up": {
          "0%": { transform: "translateY(100%)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "m3-slide-down": {
          "0%": { transform: "translateY(-100%)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "m3-slide-left": {
          "0%": { transform: "translateX(100%)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        "m3-slide-right": {
          "0%": { transform: "translateX(-100%)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        // Lazy image shimmer
        "lazy-shimmer": {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        // M3 Ripple animation - 600ms with emphasized decelerate easing
        "ripple": "ripple 600ms var(--md-sys-motion-easing-emphasized-decelerate) forwards",
        // Expressive spring animation
        "m3-spring": "m3-spring var(--md-sys-motion-duration-medium2) var(--md-sys-motion-easing-expressive) forwards",
        "m3-bounce-in": "m3-bounce-in var(--md-sys-motion-duration-medium3) var(--md-sys-motion-easing-bounce) forwards",
        // GPU-accelerated M3 animations
        "m3-scale-in": "m3-scale-in var(--md-sys-motion-duration-medium2) var(--md-sys-motion-easing-expressive) forwards",
        "m3-scale-out": "m3-scale-out var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-emphasized-accelerate) forwards",
        "m3-fade-in": "m3-fade-in var(--md-sys-motion-duration-medium2) var(--md-sys-motion-easing-standard) forwards",
        "m3-fade-out": "m3-fade-out var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-standard) forwards",
        "m3-slide-up": "m3-slide-up var(--md-sys-motion-duration-medium2) var(--md-sys-motion-easing-expressive) forwards",
        "m3-slide-down": "m3-slide-down var(--md-sys-motion-duration-medium2) var(--md-sys-motion-easing-expressive) forwards",
        "m3-slide-left": "m3-slide-left var(--md-sys-motion-duration-medium2) var(--md-sys-motion-easing-expressive) forwards",
        "m3-slide-right": "m3-slide-right var(--md-sys-motion-duration-medium2) var(--md-sys-motion-easing-expressive) forwards",
        "lazy-shimmer": "lazy-shimmer 1.5s infinite",
      },
      opacity: {
        // M3 disabled state opacity (38%)
        "38": "0.38",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config

export default config
