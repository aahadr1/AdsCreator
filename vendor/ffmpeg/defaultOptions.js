// ESM-friendly shim for @ffmpeg/ffmpeg defaultOptions in Next.js browser builds
// Always use CDN corePath to avoid dev-time local path resolution
const versionTag = process.env.NEXT_PUBLIC_FFMPEG_CORE_VERSION || '0.11.0';
const corePath = process.env.NEXT_PUBLIC_FFMPEG_CORE_URL || `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${versionTag}/dist/ffmpeg-core.js`;

export default { corePath };


