/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: process.cwd(),
  distDir: process.env.NEXT_DIST_DIR || '.next',
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true,
  },
}

import withPWAInit from '@ducanh2912/next-pwa';

const withPWA = withPWAInit({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development' || process.env.DISABLE_PWA === 'true',
  register: true,
  skipWaiting: true,
});

export default withPWA(nextConfig)
