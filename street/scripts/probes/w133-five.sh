#!/bin/sh
# Five walked runs of w133-calendar-walk, item 308's "done when". One line each.
#   SHOT_URL=http://localhost:4186/ sh scripts/probes/w133-five.sh
i=1
while [ $i -le 5 ]; do
  out=$(node scripts/probes/w133-calendar-walk.mjs 2>&1)
  code=$?
  ok=$(printf '%s' "$out" | grep -c '  ok  ')
  bad=$(printf '%s' "$out" | grep -c 'FAIL')
  where=$(printf '%s' "$out" | grep -o 'stopped at ([0-9.]*, -[0-9.]*)' | head -1)
  cal=$(printf '%s' "$out" | grep -o '\-> \[E\] read the calendar' | head -1)
  dor=$(printf '%s' "$out" | grep -o '\-> \[E\] close the door' | head -1)
  echo "run $i  exit=$code  ok=$ok fail=$bad  $where  [$cal] [$dor]"
  i=$((i + 1))
done
