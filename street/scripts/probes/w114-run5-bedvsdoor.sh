#!/bin/sh
# Item 98 — the row says "walk it, five runs". This is those five runs.
#
# `w40-bed-vs-door.mjs` is the guard that holds BOTH of the user's opposite
# complaints about the selection resolver at once, and the row warns it "fails
# one assertion under the fix". Once is an anecdote here: the check walks through
# real collision, so a single red can be a stall in the doorway rather than a
# regression. Five runs, one line each.
#
#   SHOT_URL=http://localhost:<yours>/ sh scripts/probes/w114-run5-bedvsdoor.sh <out-file>
set -u
cd "$(dirname "$0")/../.." || exit 1
OUT=${1:-/tmp/w40-runs.txt}
: > "$OUT"
i=1
while [ "$i" -le 5 ]; do
  printf '===== RUN %s =====\n' "$i" >> "$OUT"
  node scripts/w40-bed-vs-door.mjs >> "$OUT" 2>&1
  # THE EXIT CODE IS THE COMMAND'S, taken before anything else runs.
  printf 'EXIT=%s\n' "$?" >> "$OUT"
  i=$((i + 1))
done
printf 'ALLDONE\n' >> "$OUT"
