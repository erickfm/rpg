#!/bin/sh
# Item 232 — five runs of the flip proof. A stability claim in this project
# needs five, not one (BUILDER-BRIEF: "Five runs for a stability claim").
cd "$(dirname "$0")/../.." || exit 1
i=1
while [ "$i" -le 5 ]; do
  printf 'run %d: ' "$i"
  SHOT_URL="${SHOT_URL:-http://localhost:4177/}" node scripts/probes/w88-registered-checks-flip.mjs 2>&1 \
    | grep -E 'flipped green|NOT PROVEN|ABORT'
  i=$((i + 1))
done
