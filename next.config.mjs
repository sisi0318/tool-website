/**
 * 内容安全策略，分两份下发。
 *
 * 强制的一份只含四条不会误伤功能的指令：站内没有 <object> / <embed> / <base>，也没有提交到
 * 站外的表单，它们拦的是注入之后的利用手法。此前整份策略都在 Report-Only 里，又没有配上报
 * 地址，等于一条也没生效。
 *
 * 其余指令继续 Report-Only，违规只在浏览器控制台里提示：
 * - script-src 必须放开 'unsafe-inline'（Next App Router 的 RSC 内联脚本与 next-themes 的
 *   主题引导脚本）与 'unsafe-eval'（ajv、protobufjs 运行时生成代码），'wasm-unsafe-eval' 供
 *   brotli-wasm 使用。放开到这个程度，强制它也挡不住内联脚本，收益很小。
 * - connect-src 写的是 https:，而画布的 HTTP 节点会从浏览器直连用户填的地址（包括
 *   http://localhost 这类），whois 也直接访问任意 RDAP 服务器；强制就会弄坏它们。
 * 要让这一份也能强制，得先给脚本上 nonce（意味着放弃静态预渲染），再把直连请求收进白名单。
 */
const ENFORCED_CONTENT_SECURITY_POLICY = [
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join('; ')

const REPORT_ONLY_CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https:",
  "worker-src 'self' blob:",
  "media-src 'self' blob:",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join('; ')

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
          // geolocation 需放行本站:二维码工具的"位置"类型要读当前坐标。
          // camera/microphone 全站不使用,保持关闭。
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
          // 自托管时补上 HSTS(Vercel 会自行注入,重复设置无副作用)。
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
          { key: 'Content-Security-Policy', value: ENFORCED_CONTENT_SECURITY_POLICY },
          { key: 'Content-Security-Policy-Report-Only', value: REPORT_ONLY_CONTENT_SECURITY_POLICY },
        ],
      },
      {
        source: '/ocr/v1/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        // API 返回的都是即时数据,不能被中间缓存留存。
        source: '/api/(.*)',
        headers: [{ key: 'Cache-Control', value: 'no-store' }],
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
  // 社交卡片图只有分享时的爬虫会取,不该进预缓存。
  publicExcludes: ['!og.png', '!pdfjs/**/*', '!vtracer/**/*', '!ocr/**/*'],
  // 保留框架自带的静态资源缓存规则,只是把下面这条排在前面。
  extendDefaultRuntimeCaching: true,
  workboxOptions: {
    runtimeCaching: [
      {
        urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/ocr/'),
        handler: 'CacheFirst',
        options: { cacheName: 'ocr-public-models', expiration: { maxEntries: 16, maxAgeSeconds: 31536000 } },
      },
      {
        urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/vtracer/'),
        handler: 'CacheFirst',
        options: { cacheName: 'image-vectorizer-assets', expiration: { maxEntries: 6, maxAgeSeconds: 31536000 } },
      },
      {
        urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/pdfjs/'),
        handler: 'CacheFirst',
        options: { cacheName: 'pdf-viewer-assets', expiration: { maxEntries: 256, maxAgeSeconds: 31536000 } },
      },
      {
        // Dynamic RDAP hosts cannot be enumerated. Do not persist arbitrary
        // cross-origin responses; explicit same-origin asset rules stay above.
        urlPattern: ({ url, sameOrigin }) =>
          !sameOrigin || url.pathname.startsWith('/api/'),
        handler: 'NetworkOnly',
      },
    ],
  },
});

export default withPWA(nextConfig)
