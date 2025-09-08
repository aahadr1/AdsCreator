// Shim for @ffmpeg/ffmpeg defaultOptions in Next.js browser builds
// Always use CDN corePath to avoid dev-time local path resolution
let versionTag = '0.12.6';
try {
  const pkg = JSON.parse(require('fs').readFileSync(require('path').join(process.cwd(), 'package.json'), 'utf8'));
  const coreVersion = (pkg.dependencies && (pkg.dependencies['@ffmpeg/core'] || pkg.dependencies['@ffmpeg/ffmpeg']))
    || (pkg.devDependencies && (pkg.devDependencies['@ffmpeg/core'] || pkg.devDependencies['@ffmpeg/ffmpeg']))
    || null;
  if (typeof coreVersion === 'string') {
    versionTag = coreVersion.startsWith('^') ? coreVersion.substring(1) : coreVersion;
  }
} catch {}

const corePath = `https://unpkg.com/@ffmpeg/core@${versionTag}/dist/ffmpeg-core.js`;

module.exports = { default: { corePath } };


