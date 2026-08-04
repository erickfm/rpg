#!/bin/sh
# Five runs of standpoint-overlap plus its --selftest, item 308.
#   SHOT_URL=http://localhost:4186/ sh scripts/probes/w133-so-five.sh
i=1
while [ $i -le 5 ]; do
  out=$(node scripts/standpoint-overlap.mjs 2>&1)
  echo "run $i  exit=$?  $(printf '%s' "$out" | tail -1)"
  i=$((i + 1))
done
out=$(node scripts/standpoint-overlap.mjs --selftest 2>&1)
echo "selftest  exit=$?  $(printf '%s' "$out" | tail -1)"
