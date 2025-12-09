import type { Config } from "tailwindcss"

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
        // Material You 3 Color Tokens
        // ============================================
        
        // M3 Primary colors
        "md-primary": "var(--md-sys-color-primary)",
        "md-on-primary": "var(--md-sys-color-on-primary)",
        "md-primary-container": "var(--md-sys-color-primary-container)",
        "md-on-primary-container": "var(--md-sys-color-on-primary-container)",
        
        // M3 Secondary colors
        "md-secondary": "var(--md-sys-color-secondary)",
        "md-on-secondary": "var(--md-sys-color-on-secondary)",
        "md-secondary-container": "var(--md-sys-color-secondary-container)",
        "md-on-secondary-container": "var(--md-sys-color-on-secondary-container)",
        
        // M3 Tertiary colors
        "md-tertiary": "var(--md-sys-color-tertiary)",
        "md-on-tertiary": "var(--md-sys-color-on-tertiary)",
        "md-tertiary-container": "var(--md-sys-color-tertiary-container)",
        "md-on-tertiary-container": "var(--md-sys-color-on-tertiary-container)",
        
        // M3 Error colors
        "md-error": "var(--md-sys-color-error)",
        "md-on-error": "var(--md-sys-color-on-error)",
        "md-error-container": "var(--md-sys-color-error-container)",
        "md-on-error-container": "var(--md-sys-color-on-error-container)",
        
        // M3 Surface colors
        "md-surface": "var(--md-sys-color-surface)",
        "md-on-surface": "var(--md-sys-color-on-surface)",
        "md-surface-variant": "var(--md-sys-color-surface-variant)",
        "md-on-surface-variant": "var(--md-sys-color-on-surface-variant)",
        "md-surface-dim": "var(--md-sys-color-surface-dim)",
        "md-surface-bright": "var(--md-sys-color-surface-bright)",
        "md-surface-container-lowest": "var(--md-sys-color-surface-container-lowest)",
        "md-surface-container-low": "var(--md-sys-color-surface-container-low)",
        "md-surface-container": "var(--md-sys-color-surface-container)",
        "md-surface-container-high": "var(--md-sys-color-surface-container-high)",
        "md-surface-container-highest": "var(--md-sys-color-surface-container-highest)",
        
        // M3 Outline colors
        "md-outline": "var(--md-sys-color-outline)",
        "md-outline-variant": "var(--md-sys-color-outline-variant)",
        
        // M3 Other colors
        "md-shadow": "var(--md-sys-color-shadow)",
        "md-scrim": "var(--md-sys-color-scrim)",
        "md-inverse-surface": "var(--md-sys-color-inverse-surface)",
        "md-inverse-on-surface": "var(--md-sys-color-inverse-on-surface)",
        "md-inverse-primary": "var(--md-sys-color-inverse-primary)",
      },
      borderRadius: {
        // Legacy shadcn/ui compatibility
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        
        // ============================================
        // M3 Expressive Shape Tokens
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
        // M3 Motion Easing Tokens
        // ============================================
        "md-standard": "var(--md-sys-motion-easing-standard)",
        "md-standard-decelerate": "var(--md-sys-motion-easing-standard-decelerate)",
        "md-standard-accelerate": "var(--md-sys-motion-easing-standard-accelerate)",
        "md-emphasized": "var(--md-sys-motion-easing-emphasized)",
        "md-emphasized-decelerate": "var(--md-sys-motion-easing-emphasized-decelerate)",
        "md-emphasized-accelerate": "var(--md-sys-motion-easing-emphasized-accelerate)",
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
        // GPU-accelerated M3 animations
        "m3-scale-in": "m3-scale-in var(--md-sys-motion-duration-medium2) var(--md-sys-motion-easing-emphasized-decelerate) forwards",
        "m3-scale-out": "m3-scale-out var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-emphasized-accelerate) forwards",
        "m3-fade-in": "m3-fade-in var(--md-sys-motion-duration-medium2) var(--md-sys-motion-easing-standard) forwards",
        "m3-fade-out": "m3-fade-out var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-standard) forwards",
        "m3-slide-up": "m3-slide-up var(--md-sys-motion-duration-medium2) var(--md-sys-motion-easing-emphasized-decelerate) forwards",
        "m3-slide-down": "m3-slide-down var(--md-sys-motion-duration-medium2) var(--md-sys-motion-easing-emphasized-decelerate) forwards",
        "m3-slide-left": "m3-slide-left var(--md-sys-motion-duration-medium2) var(--md-sys-motion-easing-emphasized-decelerate) forwards",
        "m3-slide-right": "m3-slide-right var(--md-sys-motion-duration-medium2) var(--md-sys-motion-easing-emphasized-decelerate) forwards",
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
