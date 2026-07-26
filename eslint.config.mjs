import { FlatCompat } from "@eslint/eslintrc"

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
})

const eslintConfig = [
  ...compat.extends("next/core-web-vitals"),
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
