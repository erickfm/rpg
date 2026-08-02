#!/bin/sh
# Item 58: measure the interiors-walk flake rather than guess at it.
#
# Runs `interiors-walk.mjs <room>` N times and prints, per run, the exit status
# and every FAIL line. The point is the IDENTITY of the failing checks across
# runs, not the count — w24 measured "0,0,6,0" and "0,0,0,6", which is a whole
# BLOCK of checks failing together in one run and none in the others, and that
# shape says something different from six unrelated flakes.
#
# `$?` AFTER A PIPELINE IS THE LAST COMMAND'S STATUS, so the run's status is
# captured before anything is piped (BUILDER-BRIEF §7 lists this exact trap).
#
# Usage: SHOT_URL=http://localhost:4193/ sh scripts/probes/w30-iw-flake.sh bodega 8
set -u
cd "$(dirname "$0")/../.." || exit 1
room=${1:-bodega}
n=${2:-8}
i=1
while [ "$i" -le "$n" ]; do
  out=$(node scripts/interiors-walk.mjs "$room" 2>&1)
  st=$?
  fails=$(printf '%s\n' "$out" | grep -c '^FAIL')
  printf '=== run %s/%s  exit=%s  FAILs=%s\n' "$i" "$n" "$st" "$fails"
  printf '%s\n' "$out" | grep '^FAIL' | sed 's/^/    /'
  i=$((i + 1))
done
