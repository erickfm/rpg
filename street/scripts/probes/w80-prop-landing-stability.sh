#!/bin/sh
# Five runs of prop-landing.mjs. A stability claim needs five runs; one is an
# anecdote, and this project has shipped a FLAKY check before (canfail's wetness
# case measured CAUGHT, CAUGHT, SLEPT, SLEPT, CAUGHT).
#   SHOT_URL=http://localhost:4360/ sh scripts/probes/w80-prop-landing-stability.sh
set -u
cd "$(dirname "$0")/../.." || exit 1
i=1
while [ "$i" -le 5 ]; do
  out=$(node scripts/prop-landing.mjs 2>&1)
  rc=$?
  echo "run $i  exit=$rc  $(printf '%s' "$out" | grep -o '[0-9]*/[0-9]* passed')  $(printf '%s' "$out" | grep -o '[0-9]* movers, all matching BASELINE to 2 mm')"
  i=$((i + 1))
done
