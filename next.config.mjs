import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
// No direct webpack import; rely on aliasing and client dynamic import

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {},
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'ueunqeqrvtuofpdoozye.supabase.co' },
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
  headers: async () => [],
};

export default nextConfig;
