import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

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
  webpack: (config) => {
    // Workaround for @ffmpeg/ffmpeg dev corePath resolution in Next.js
    // Force using our shim that points to CDN for corePath
    let ffmpegDefaultOptionsPath;
    try {
      ffmpegDefaultOptionsPath = require.resolve('@ffmpeg/ffmpeg/src/browser/defaultOptions.js');
    } catch {}
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      '@ffmpeg/ffmpeg/src/browser/defaultOptions.js': path.join(
        process.cwd(),
        'vendor/ffmpeg/defaultOptions.js'
      ),
      ...(ffmpegDefaultOptionsPath
        ? {
            [ffmpegDefaultOptionsPath]: path.join(
              process.cwd(),
              'vendor/ffmpeg/defaultOptions.js'
            ),
          }
        : {}),
    };
    return config;
  },
};

export default nextConfig;
