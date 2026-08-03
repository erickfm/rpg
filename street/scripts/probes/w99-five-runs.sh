#!/bin/sh
# Five runs of w99-tyre-seating against one world, so the handoff can quote a
# SPREAD rather than a single lucky number. Deterministic geometry should give
# five identical lines; if it does not, that is the finding.
#   SHOT_URL=http://localhost:<port>/ sh scripts/probes/w99-five-runs.sh
i=1
while [ $i -le 5 ]; do
  out=$(node scripts/probes/w99-tyre-seating.mjs 2>&1)
  code=$?
  echo "run $i exit=$code"
  echo "$out" | grep -E 'car tyre|bus tyre|trailer |jacked'
  i=$((i + 1))
done
