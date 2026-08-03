#!/bin/sh
# Item 204 — five runs of the crate probe. One green run is not a stability
# claim; dimWorld's push-out pass is iterative and the world seeds its own
# randomness, so "it landed there" needs repeating before it is a fact.
#   SHOT_URL=http://localhost:4330/ sh scripts/probes/w77-five-runs.sh
set -u
i=1
while [ "$i" -le 5 ]; do
  out=$(node scripts/probes/w77-thrift-crate.mjs 2>&1)
  code=$?
  pos=$(printf '%s\n' "$out" | grep 'milk crate' | grep -- '-37\.' | tr -s ' ')
  verdict=$(printf '%s\n' "$out" | grep -E '^(PASS|FAIL)')
  printf 'run %s  exit=%s  %s  |%s\n' "$i" "$code" "$verdict" "$pos"
  i=$((i + 1))
done
