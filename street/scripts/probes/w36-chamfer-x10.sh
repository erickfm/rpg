#!/bin/sh
# Item 67's acceptance run: w24-chamfer-walk.mjs, N times under CPU throttle,
# one line of verdict per run.
#
# w34 fixed the flake (both legs now end on world state instead of a fixed
# 2600 ms window) and then died before proving it. The proof is a REPEAT count,
# because the defect was scatter and not a wrong number: on identical world
# bytes the old §4a cleared 2.58 / 3.48 / 4.63 / 8.32 / 8.41 m against a 2.83 m
# face, so any single green run — including the two w34 got — proves nothing.
# Ten in a row with the "cleared" distance printed each time does, and printing
# the distance is the point: ten passes that all cleared the SAME distance is a
# load-independent measurement, ten that scatter would mean the fix missed.
#
# Every run is a fresh browser, so a run cannot inherit the previous one's
# warmed JIT — which is the thing that would quietly make later runs easier.
#
#   SHOT_URL=http://localhost:<port>/ CPU_THROTTLE=8 sh scripts/probes/w36-chamfer-x10.sh [N]
#
# Exits non-zero if ANY run fails — printing is not failing (a check must exit
# non-zero to fail, and this file exists to be an acceptance gate).
N=${1:-10}
: "${SHOT_URL:?set SHOT_URL to YOUR OWN world — GOTCHAS 48}"
pass=0
i=1
while [ "$i" -le "$N" ]; do
  out=$(node scripts/probes/w24-chamfer-walk.mjs 2>&1)
  rc=$?
  cleared=$(printf '%s\n' "$out" | grep -E 'cleared the corner|did NOT clear' | head -1)
  if [ "$rc" -eq 0 ]; then
    pass=$((pass + 1))
    printf 'run %2d  PASS  rc=%d  %s\n' "$i" "$rc" "$cleared"
  else
    printf 'run %2d  FAIL  rc=%d  %s\n' "$i" "$rc" "$cleared"
    printf '%s\n' "$out" | grep -E '^FAIL|CHECK\(S\) FAILED|console errors'
  fi
  i=$((i + 1))
done
printf '\n%d/%d passed at CPU_THROTTLE=%s against %s\n' "$pass" "$N" "${CPU_THROTTLE:-1}" "$SHOT_URL"
[ "$pass" -eq "$N" ]
