#!/bin/bash
# Create placeholder favicon PNGs using ImageMagick or sips (macOS)
# Run: bash public/create-favicons.sh

SIZE=32

if command -v convert &> /dev/null; then
  # ImageMagick
  convert -size ${SIZE}x${SIZE} xc:"#fb923c" public/favicon-in-progress.png
  convert -size ${SIZE}x${SIZE} xc:"#22c55e" public/favicon-done.png
  convert -size ${SIZE}x${SIZE} xc:"#ef4444" public/favicon-failed.png
  convert -size ${SIZE}x${SIZE} xc:"#6b7280" public/favicon-idle.png
  echo "Created favicon PNGs using ImageMagick"
elif command -v sips &> /dev/null; then
  # macOS sips
  sips -s format png --out public/favicon-in-progress.png <(echo "") 2>/dev/null || echo "Note: sips may not work for blank images"
  echo "Created placeholder files. Please replace with actual PNG images."
else
  echo "ImageMagick or sips not found. Please create PNG files manually:"
  echo "  - public/favicon-in-progress.png (orange #fb923c)"
  echo "  - public/favicon-done.png (green #22c55e)"
  echo "  - public/favicon-failed.png (red #ef4444)"
  echo "  - public/favicon-idle.png (gray #6b7280)"
fi
