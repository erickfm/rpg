#!/bin/sh
# Five runs of casinodoor.mjs, printing exit code and pass count for each.
# A stability claim needs five runs; one run is an anecdote.
#   SHOT_URL=http://localhost:4360/ sh scripts/probes/w80-casinodoor-stability.sh
set -u
cd "$(dirname "$0")/../.." || exit 1
i=1
while [ "$i" -le 5 ]; do
  out=$(node scripts/casinodoor.mjs 2>&1)
  rc=$?
  echo "run $i  exit=$rc  $(printf '%s' "$out" | grep -o '[0-9]*/[0-9]* passed')  band=$(printf '%s' "$out" | grep -o 'fired at x \[[^]]*\]')"
  i=$((i + 1))
done
