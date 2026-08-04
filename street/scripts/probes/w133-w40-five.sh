#!/bin/sh
# Five runs of w40-bed-vs-door, item 308. The interesting column is the LAST
# one: its "both offers must actually fire" step lands on a 23.1 deg pose
# against a 25 deg cone, so it is a coin toss on mainline AND on this branch —
# see scripts/probes/w133-w40-fire.mjs and commit 97d34a160.
#   SHOT_URL=http://localhost:4186/ sh scripts/probes/w133-w40-five.sh
i=1
while [ $i -le 5 ]; do
  out=$(node scripts/w40-bed-vs-door.mjs 2>&1)
  code=$?
  bad=$(printf '%s' "$out" | grep -c 'FAIL')
  fire=$(printf '%s' "$out" | grep -o 'firing from [0-9.]* m' | head -1)
  which=$(printf '%s' "$out" | grep 'offered door actually acted' | head -1 | cut -c1-16)
  echo "run $i  exit=$code  FAILs=$bad  $fire  $which"
  i=$((i + 1))
done
