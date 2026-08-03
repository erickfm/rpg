#!/bin/sh
# Item 247. Five runs of the guard self-test, reporting the spread -- the guard
# reads /proc and shells out to git, so "it passed once" is not the same claim
# as "it passes". Run from street/.
cd "$(dirname "$0")/../.." || exit 1
i=1
while [ $i -le 5 ]; do
  out=$(node scripts/probes/w94-guard-selftest.mjs 2>&1)
  code=$?
  echo "run $i  exit=$code  $(printf '%s\n' "$out" | tail -1)"
  i=$((i + 1))
done
