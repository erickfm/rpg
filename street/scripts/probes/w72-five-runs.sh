#!/usr/bin/env bash
# w72 / item 209 — five runs of one check on UNCHANGED source.
#
# The row is explicit that a single green run is not evidence here: the broken
# version of this pattern passed three times in four. So the claim being made is
# "identical verdict five runs running", and this is what makes it.
#
# Usage: SHOT_URL=http://localhost:4280/ scripts/probes/w72-five-runs.sh <script.mjs> <tag> [args...]
set -u
S="$1"; TAG="$2"; shift 2
for i in 1 2 3 4 5; do
  node "$S" "$@" > "/tmp/w72-$TAG-s$i.log" 2>&1
  echo "run $i  exit=$?  $(grep -oE '[0-9]+/[0-9]+ (distinct opaque materials changed|interior materials kept their colour|passed)' "/tmp/w72-$TAG-s$i.log" | tr '\n' ' | ')"
done
