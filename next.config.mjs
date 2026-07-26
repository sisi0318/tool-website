/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: process.cwd(),
  distDir: process.env.NEXT_DIST_DIR || '.next',
  poweredByHeader: false,
  // Windows 本地并行导出与 PWA 写盘存在文件竞态(杀软扫描锁),串行化以保证构建确定性;
  // Linux/Vercel 不受影响,保持并行。
  ...(process.platform === 'win32'
    ? { experimental: { cpus: 1, workerThreads: false } }
    : {}),
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
}

import withPWAInit from '@ducanh2912/next-pwa';

const withPWA = withPWAInit({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development' || process.env.DISABLE_PWA === 'true',
  register: true,
  skipWaiting: true,
  fallbacks: {
    document: '/~offline',
  },
});

export default withPWA(nextConfig)
