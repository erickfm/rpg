#!/bin/sh
# ITEM 181 UNDER LOAD — GOTCHAS §30's recipe, because this fault IS load.
#
# `w63-painted.mjs` on an idle machine reports that recipe A (rAF only) caught a
# painted frame, which is exactly how a race looks when you win it. Sixtyone did
# not win it. Six copies at once is what makes the difference visible, and it is
# the same harness GOTCHAS §30 prescribes for `door301` and `lotwalk`.
#
#   SHOT_URL=http://localhost:4191/ sh scripts/probes/w63-painted-load.sh [n]
set -u
n=${1:-6}
here=$(cd "$(dirname "$0")" && pwd)
i=1
while [ "$i" -le "$n" ]; do
  node "$here/w63-painted.mjs" > "/tmp/w63-load-$i.log" 2>&1 &
  i=$((i + 1))
done
wait
echo
echo "  ── $n concurrent runs ─────────────────────────────────────────────"
i=1
blackA=0
while [ "$i" -le "$n" ]; do
  a=$(grep '^  A ' "/tmp/w63-load-$i.log" | sed 's/^  A *//')
  b=$(grep '^  B ' "/tmp/w63-load-$i.log" | sed 's/^  B *//')
  v=$(grep -c 'FAILED' "/tmp/w63-load-$i.log")
  printf '  run %s  %s\n           %s   %s\n' "$i" "$a" "$b" "$([ "$v" = 0 ] && echo '' || echo 'FAILED')"
  grep -q 'recipe A DID shoot the void' "/tmp/w63-load-$i.log" && blackA=$((blackA + 1))
  i=$((i + 1))
done
echo
echo "  recipe A (rAF only) shot the void in $blackA of $n runs"
fails=$(grep -l 'FAILED' /tmp/w63-load-*.log 2>/dev/null | wc -l | tr -d ' ')
echo "  recipe B (waitPainted) failed in $fails of $n runs"
echo
[ "$fails" = 0 ] || exit 1
