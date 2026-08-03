#!/bin/sh
# Item 199: five consecutive runs of the registered check, to report the spread
# rather than a single green. Usage: SHOT_URL=http://localhost:4650/ sh scripts/probes/w109-five-runs.sh
cd "$(dirname "$0")/../.." || exit 1
i=1
while [ $i -le 5 ]; do
  SHOT_URL="$SHOT_URL" node scripts/watch-vs-panel.mjs "/tmp/w109-run$i" > "/tmp/w109-run$i.txt" 2>&1
  rc=$?
  printf 'run %s  exit=%s  %s  %s\n' "$i" "$rc" \
    "$(grep -E '^WATCH/PANEL' "/tmp/w109-run$i.txt")" \
    "$(grep '^population:' "/tmp/w109-run$i.txt")"
  i=$((i + 1))
done
