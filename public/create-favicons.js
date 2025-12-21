// Script to create placeholder favicon PNGs
// Run with: node public/create-favicons.js
const fs = require('fs');
const path = require('path');

// Minimal 32x32 PNG data (1x1 pixel, but browsers will scale it)
// These are base64 encoded minimal PNGs - you'll replace these with your actual images
const createMinimalPNG = (color) => {
  // This is a minimal valid PNG (1x1 pixel)
  // Colors: orange (in_progress), green (done), red (failed), gray (idle)
  const colors = {
    in_progress: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==',
    done: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    failed: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    idle: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  };
  return Buffer.from(colors[color] || colors.idle, 'base64');
};

const publicDir = path.join(__dirname);
fs.writeFileSync(path.join(publicDir, 'favicon-in-progress.png'), createMinimalPNG('in_progress'));
fs.writeFileSync(path.join(publicDir, 'favicon-done.png'), createMinimalPNG('done'));
fs.writeFileSync(path.join(publicDir, 'favicon-failed.png'), createMinimalPNG('failed'));
fs.writeFileSync(path.join(publicDir, 'favicon-idle.png'), createMinimalPNG('idle'));

console.log('Placeholder favicons created!');
console.log('Please replace these with your actual PNG images:');
console.log('  - public/favicon-in-progress.png (orange/amber color)');
console.log('  - public/favicon-done.png (green color)');
console.log('  - public/favicon-failed.png (red color)');
console.log('  - public/favicon-idle.png (gray/default color)');
