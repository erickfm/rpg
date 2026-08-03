#!/bin/sh
# ITEM 272 — five runs of the legs check, and report the SPREAD, not the last
# verdict. A screenshot-differencing check on a world with animated screens is
# exactly the kind that passes four times and fails once; if that is true here
# it has to be visible, not averaged away.
#
#   SHOT_URL=http://localhost:<port>/ sh scripts/probes/w112-five-runs.sh
cd "$(dirname "$0")/../.." || exit 1
n=1
while [ "$n" -le 5 ]; do
  out=$(SHOT_URL="$SHOT_URL" node scripts/probes/w112-legs-below-the-seat.mjs 2>&1)
  code=$?
  echo "run $n  exit=$code  $(printf '%s' "$out" | grep -E '^(PASS|FAIL|EXIT 3)')"
  printf '%s' "$out" | grep -E 'sitters;' | sed 's/^/        /'
  printf '%s' "$out" | grep -E 'NO LEG BELOW|IMPLAUSIBLE|TOO NOISY|NOT VISIBLE' | sed 's/^/        /'
  n=$((n + 1))
done
