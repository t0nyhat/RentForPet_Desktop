#!/usr/bin/env bash
set -euo pipefail

SOURCE_FILE="${1:-assets/icon-source.png}"
OUT_DIR="build/icons"
ICONSET_DIR="$OUT_DIR/icon.iconset"

if [[ ! -f "$SOURCE_FILE" ]]; then
  echo "Source image not found: $SOURCE_FILE"
  echo "Put your source image at assets/icon-source.png or pass a custom path."
  exit 1
fi

if ! command -v sips >/dev/null 2>&1; then
  echo "sips is required (macOS)."
  exit 1
fi

mkdir -p "$OUT_DIR"
rm -rf "$ICONSET_DIR"
mkdir -p "$ICONSET_DIR"

# Base PNG for Electron/Linux and fallback
sips -s format png -z 1024 1024 "$SOURCE_FILE" --out "$OUT_DIR/icon.png" >/dev/null

# macOS iconset sizes
sips -s format png -z 16 16 "$SOURCE_FILE" --out "$ICONSET_DIR/icon_16x16.png" >/dev/null
sips -s format png -z 32 32 "$SOURCE_FILE" --out "$ICONSET_DIR/icon_16x16@2x.png" >/dev/null
sips -s format png -z 32 32 "$SOURCE_FILE" --out "$ICONSET_DIR/icon_32x32.png" >/dev/null
sips -s format png -z 64 64 "$SOURCE_FILE" --out "$ICONSET_DIR/icon_32x32@2x.png" >/dev/null
sips -s format png -z 128 128 "$SOURCE_FILE" --out "$ICONSET_DIR/icon_128x128.png" >/dev/null
sips -s format png -z 256 256 "$SOURCE_FILE" --out "$ICONSET_DIR/icon_128x128@2x.png" >/dev/null
sips -s format png -z 256 256 "$SOURCE_FILE" --out "$ICONSET_DIR/icon_256x256.png" >/dev/null
sips -s format png -z 512 512 "$SOURCE_FILE" --out "$ICONSET_DIR/icon_256x256@2x.png" >/dev/null
sips -s format png -z 512 512 "$SOURCE_FILE" --out "$ICONSET_DIR/icon_512x512.png" >/dev/null
cp "$OUT_DIR/icon.png" "$ICONSET_DIR/icon_512x512@2x.png"

if command -v iconutil >/dev/null 2>&1; then
  iconutil -c icns "$ICONSET_DIR" -o "$OUT_DIR/icon.icns"
else
  echo "iconutil not found, icon.icns was not generated."
fi

# Best-effort ICO generation for Windows builds
if sips -s format ico "$OUT_DIR/icon.png" --out "$OUT_DIR/icon.ico" >/dev/null 2>&1; then
  echo "icon.ico generated"
else
  echo "Could not generate icon.ico via sips."
  echo "For Windows builds, create $OUT_DIR/icon.ico manually if needed."
fi

echo "Icons generated in $OUT_DIR"
