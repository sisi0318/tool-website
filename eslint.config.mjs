import { defineConfig, globalIgnores } from "eslint/config"
import nextVitals from "eslint-config-next/core-web-vitals"

// eslint-config-next 16 起直接导出 flat config,不再经 @eslint/eslintrc 的 FlatCompat 转一道
// (FlatCompat 读 16 的配置会在校验时报 “Converting circular structure to JSON”)。
const eslintConfig = defineConfig([
  ...nextVitals,
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
    /**
     * 这五条是 eslint-config-next 16 带进来的 React Compiler 诊断(eslint-plugin-react-hooks 的新预设),
     * 检查的是“代码能不能交给编译器自动记忆化”。本站没有启用 React Compiler。
     *
     * 升级当天它们在 62 个文件里报出 110 处既有写法:挂载后从本地存储恢复状态(set-state-in-effect,76 处)、
     * 渲染期间读写 ref(refs,16 处)、手写的 useMemo/useCallback 无法原样保留(7 处)、
     * 先用后声明与改动外部值(immutability,6 处)、在渲染里定义组件(static-components,5 处,都在 crontab 页)。
     * 逐处改是一轮单独的重构,不该混在升级里;先保持升级前的检查范围,以后一条一条打开。
     */
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/immutability": "off",
      "react-hooks/static-components": "off",
    },
  },
  globalIgnores([
    ".next/**",
    ".next-e2e/**",
    "node_modules/**",
    "CyberChef/**",
    "public/**",
    "test-results/**",
    "playwright-report/**",
    "next-env.d.ts",
  ]),
])

export default eslintConfig
