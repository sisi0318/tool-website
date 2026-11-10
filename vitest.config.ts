import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'react',
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    // tmp/ 与 CyberChef/ 是被 gitignore 的本地草稿和参考拷贝，.next-e2e/ 是另一份构建输出：
    // 只在开发机上存在，里面的 *.spec.ts 是 Playwright 的写法，被 vitest 扫到就会报一个本不存在的失败
    exclude: ['node_modules', '.next', '.next-e2e/**', 'e2e/**', 'tmp/**', 'CyberChef/**'],
    setupFiles: ['./vitest.setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
