#!/bin/sh
# Five runs of w103-fence-loop.mjs, reporting the spread and what the loot roll
# handed over each time.
#
# WHY FIVE IS STILL RIGHT AFTER ITEM 261, THOUGH FOR A DIFFERENT REASON. It used
# to be structural: the probe could only measure money through the bodega's
# $2.50 threshold, so a $0.25 catalogue proved nothing and only repetition
# reached the discriminating branch. `__ct.purse()` made every sale
# discriminating — the assertion is now `after − before === the price the
# counter named` — so one run is a whole check of the money. Five are kept
# because the loot table is a roll and the run walks real geometry: this is
# where a landing reachable only on some storeys, or an item whose price string
# does not parse, shows up. Report the spread. (BUILDER-BRIEF §10.)
cd "$(dirname "$0")/../.." || exit 3
i=1
while [ "$i" -le 5 ]; do
  node scripts/probes/w103-fence-loop.mjs > "/tmp/w103-run$i.txt" 2>&1
  st=$?
  score=$(grep -oE '[0-9]+/[0-9]+ passed' "/tmp/w103-run$i.txt")
  sold=$(grep -oE '[0-9]+ of a required [0-9]+ sales completed' "/tmp/w103-run$i.txt" | head -1)
  goods=$(grep -A1 'THE MONEY MOVED' "/tmp/w103-run$i.txt" | tail -1 | sed 's/^ *//')
  echo "run $i  exit=$st  $score  |  $sold"
  echo "        $goods"
  i=$((i + 1))
done
