#!/bin/sh
# Five runs of w103-fence-loop.mjs, reporting the spread and WHICH SIGN of the
# money threshold each one exercised. The loot roll decides: at $2.00 in the
# wallet, a $0.25 catalogue does NOT cross the bodega's $2.50 line and anything
# dearer does. A single run is therefore half a check, and only repetition
# reaches both branches. (BUILDER-BRIEF — five runs, report the spread.)
cd "$(dirname "$0")/../.." || exit 3
i=1
while [ "$i" -le 5 ]; do
  node scripts/probes/w103-fence-loop.mjs > "/tmp/w103-run$i.txt" 2>&1
  st=$?
  score=$(grep -oE '[0-9]+/[0-9]+ passed' "/tmp/w103-run$i.txt")
  goods=$(grep -oE 'sell the [^—]*— \$[0-9.]+' "/tmp/w103-run$i.txt" | head -1)
  sign=$(grep -oE 'reached a CROSSING.*|[0-9]+ sale\(s\): .*' "/tmp/w103-run$i.txt" | tail -1)
  echo "run $i  exit=$st  $score  |  $goods  |  $sign"
  i=$((i + 1))
done
