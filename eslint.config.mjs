import { FlatCompat } from "@eslint/eslintrc"

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
})

const eslintConfig = [
  ...compat.extends("next/core-web-vitals"),
  {
    rules: {
      /**
       * 本站所有 <img> 渲染的都是用户在本地选择的图片(object URL / data URL),
       * 没有远程或静态图片;next.config 里也已 images.unoptimized = true。
       * next/image 在这种场景下不做任何优化,只会多一层布局机制。
       */
      "@next/next/no-img-element": "off",
    },
  },
  {
    ignores: [
      ".next/**",
      ".next-e2e/**",
      "node_modules/**",
      "CyberChef/**",
      "public/**",
      "test-results/**",
      "playwright-report/**",
      "next-env.d.ts",
    ],
  },
]

export default eslintConfig
