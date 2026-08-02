#!/bin/sh
# w38 — ITEM 78. Run w24-chamfer-walk.mjs N times and KEEP THE WHOLE OUTPUT of
# every run, named by its verdict.
#
# scripts/probes/w36-chamfer-x10.sh greps a single verdict line out of each run
# and throws the rest away. That is the right shape for an acceptance gate and
# the wrong shape for chasing a flake: when a run finally goes red, the track
# that explains it has already been discarded and the only way back is to wait
# for it to happen again — at ~97 s a run.
#
#   SHOT_URL=http://localhost:<port>/ OUT=/tmp/w38-cap sh scripts/probes/w38-chamfer-capture.sh [N]
N=${1:-5}
: "${SHOT_URL:?set SHOT_URL to YOUR OWN world — GOTCHAS 48}"
OUT=${OUT:-/tmp/w38-chamfer-capture}
mkdir -p "$OUT"
i=1
while [ "$i" -le "$N" ]; do
  node scripts/probes/w24-chamfer-walk.mjs > "$OUT/run-$i.txt" 2>&1
  rc=$?
  # Read the status UNPIPED, then label the file by it.
  if [ "$rc" -eq 0 ]; then
    printf 'run %2d  PASS\n' "$i"
  else
    mv "$OUT/run-$i.txt" "$OUT/run-$i-FAILED.txt"
    printf 'run %2d  FAIL rc=%d  -> %s/run-%d-FAILED.txt\n' "$i" "$rc" "$OUT" "$i"
    grep -E '^FAIL|leg ended' "$OUT/run-$i-FAILED.txt"
  fi
  i=$((i + 1))
done
