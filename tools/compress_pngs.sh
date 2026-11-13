#!/usr/bin/env bash
# Lossy-then-lossless compress every PNG under public/assets (recursive).
# pngquant quality band keeps pixel-art readable; --skip-if-larger keeps the original
# when the palette version would grow or look worse. optipng then squeezes more.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIR="${1:-$ROOT/public/assets}"

before=$(find "$DIR" -name '*.png' -printf '%s\n' | awk '{s+=$1} END {print s+0}')
count=$(find "$DIR" -name '*.png' | wc -l)
echo "before: $before bytes in $count PNGs under $DIR"

# work on a copy-in-place; pngquant overwrites when --ext .png --force
find "$DIR" -name '*.png' -print0 | while IFS= read -r -d '' f; do
  pngquant --quality=80-95 --speed 1 --skip-if-larger --force --ext .png "$f" 2>/dev/null || true
  optipng -quiet -o2 "$f" || true
done

after=$(find "$DIR" -name '*.png' -printf '%s\n' | awk '{s+=$1} END {print s+0}')
echo "after:  $after bytes"
python3 - << PY
before, after = $before, $after
saved = before - after
pct = (100.0 * saved / before) if before else 0
print(f"saved:  {saved} bytes ({pct:.1f}%)")
PY
