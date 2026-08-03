#!/bin/sh
# Item 280 — five runs of the item-93 seat-suppression check, because one green
# run of anything on this project is a coin toss you did not watch land.
cd "$(dirname "$0")/../.." || exit 1
i=1
while [ $i -le 5 ]; do
  out=$(SHOT_URL=http://localhost:4690/ node scripts/probes/w113-280-item93-inside.mjs 2>&1)
  code=$?
  echo "run $i  exit $code  $(echo "$out" | grep 'casino seats')"
  i=$((i + 1))
done
