#!/bin/sh
# Item 268 — five runs of the handedness verdict, exit code per run.
# One reading is an anecdote; the row's DONE-WHEN is a check that has to hold.
cd "$(dirname "$0")/../.." || exit 3
i=1
while [ "$i" -le 5 ]; do
  out=$(SHOT_URL="${SHOT_URL:-http://localhost:4642/}" node scripts/probes/w108-item268-handedness.mjs 2>&1)
  rc=$?
  printf 'run %d  exit %d  %s | %s\n' "$i" "$rc" \
    "$(printf '%s' "$out" | grep -o 'cx [0-9.]*   casino room cx [0-9.]*')" \
    "$(printf '%s' "$out" | grep -o 'VERDICT: [A-Z]*')"
  i=$((i + 1))
done
