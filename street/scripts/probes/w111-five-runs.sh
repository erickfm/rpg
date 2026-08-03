#!/bin/sh
# Five runs of w111-mug-empty, so the SPREAD is reported rather than one lucky
# reading. Exit code is taken from the node command itself, never after a pipe.
cd "$(dirname "$0")/../.." || exit 9
fail=0
for i in 1 2 3 4 5; do
  SHOT_URL="${SHOT_URL:-http://localhost:4672/}" node scripts/probes/w111-mug-empty.mjs "run$i" > "/tmp/w111r$i.txt" 2>&1
  code=$?
  [ "$code" -ne 0 ] && fail=$((fail + 1))
  printf 'run%d exit=%d  ' "$i" "$code"
  grep -E 'interior vs RIM|interior vs SILL|not coffee|fill of projected' "/tmp/w111r$i.txt" \
    | sed 's/^ *//' | tr '\n' ' '
  printf '\n'
done
echo "runs failing: $fail of 5"
exit "$fail"
