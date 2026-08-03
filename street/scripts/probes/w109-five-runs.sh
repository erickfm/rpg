#!/bin/sh
# Five consecutive runs of a registered check, to report the SPREAD rather than a
# single green. Written for item 199, reused for item 277.
#   SHOT_URL=http://localhost:4650/ sh scripts/probes/w109-five-runs.sh watch-vs-panel
#   SHOT_URL=http://localhost:4650/ sh scripts/probes/w109-five-runs.sh pointer-returns
cd "$(dirname "$0")/../.." || exit 1
CHECK="${1:-watch-vs-panel}"
i=1
while [ $i -le 5 ]; do
  SHOT_URL="$SHOT_URL" node "scripts/$CHECK.mjs" "/tmp/w109-$CHECK-$i" > "/tmp/w109-$CHECK-$i.txt" 2>&1
  rc=$?
  printf 'run %s  exit=%s  %s  %s\n' "$i" "$rc" \
    "$(grep -E '^(WATCH/PANEL|POINTER)' "/tmp/w109-$CHECK-$i.txt")" \
    "$(grep -E '^(population:|exits driven)' "/tmp/w109-$CHECK-$i.txt" | tr '\n' ' ')"
  i=$((i + 1))
done
