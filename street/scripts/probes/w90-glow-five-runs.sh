#!/bin/sh
# Five consecutive glow.mjs probe runs — the stability leg item 241 asks for.
# Usage: SHOT_URL=http://localhost:4460/ sh scripts/probes/w90-glow-five-runs.sh
for i in 1 2 3 4 5; do
  node scripts/glow.mjs probe > "/tmp/ninety-run$i.txt" 2>&1
  echo "── run $i exit=$?"
  grep -E 'median |dimmest |keeps |usable \(floor' "/tmp/ninety-run$i.txt"
done
