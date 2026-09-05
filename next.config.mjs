/**
 * 内容安全策略。
 *
 * 先以 Report-Only 上线观察，确认无误报后把 header 名改成 Content-Security-Policy。
 * script-src 必须放开 'unsafe-inline'（Next App Router 的 RSC 内联脚本与
 * next-themes 的主题引导脚本）与 'unsafe-eval'（ajv、protobufjs 运行时生成代码），
 * 'wasm-unsafe-eval' 供 brotli-wasm 使用。即便如此，object-src / base-uri /
 * form-action / frame-ancestors 仍能挡住相当一部分注入后的利用手法。
 *
 * connect-src 暂时只能放宽到 https:：whois 工具直接从浏览器访问任意 RDAP 服务器。
 * 若后续把 whois 全部改走 /api/whois，这里可以收紧成显式白名单。
 */
const CONTENT_SECURITY_POLICY = [
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
          { key: 'Content-Security-Policy-Report-Only', value: CONTENT_SECURITY_POLICY },
        ],
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
  // 1.1MB 的社交卡片图只在分享时用到,不该进预缓存。
  publicExcludes: ['!og.jpg', '!pdfjs/**/*'],
  // 保留框架自带的静态资源缓存规则,只是把下面这条排在前面。
  extendDefaultRuntimeCaching: true,
  workboxOptions: {
    runtimeCaching: [
      {
        urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/pdfjs/'),
        handler: 'CacheFirst',
        options: { cacheName: 'pdf-viewer-assets', expiration: { maxEntries: 256, maxAgeSeconds: 31536000 } },
      },
      {
        // 默认规则会把同源 /api/* 与所有跨域 GET 用 NetworkFirst 落盘,
        // 于是 IP 归属地、RDAP 注册人信息等会被写进 CacheStorage,
        // 还会绕过工具页自己的缓存开关。这类响应一律不缓存。
        urlPattern: ({ url, sameOrigin }) =>
          (sameOrigin && url.pathname.startsWith('/api/')) ||
          /^https:\/\/(api-ipv4\.ip\.sb|open\.er-api\.com|web-proxy\.apifox\.cn|data\.iana\.org)/.test(url.href),
        handler: 'NetworkOnly',
      },
    ],
  },
});

export default withPWA(nextConfig)
