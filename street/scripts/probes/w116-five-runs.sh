#!/usr/bin/env bash
# Item 284 — five runs of the canvas-click probe, reporting the spread.
# Exit codes come from the COMMAND, never after a pipe.
cd "$(dirname "$0")/../.." || exit 3
pass=0; fail=0
for i in 1 2 3 4 5; do
  out="$(SHOT_URL="${SHOT_URL:-http://localhost:4720/}" node scripts/probes/w116-canvas-click-uncaught.mjs 2>&1)"
  code=$?
  errs="$(printf '%s\n' "$out" | grep -c 'PAGEERROR:')"
  verdict="$(printf '%s\n' "$out" | grep -E 'CANVAS CLICK')"
  calls="$(printf '%s\n' "$out" | grep -oE '\([0-9]+ requestPointerLock calls')"
  echo "run $i: exit=$code  pageerrors=$errs  $calls)  $verdict"
  if [ "$code" -eq 0 ]; then pass=$((pass+1)); else fail=$((fail+1)); printf '%s\n' "$out" | grep -E '^   FAIL'; fi
done
echo "SPREAD: $pass/5 clean, $fail/5 failed"
[ "$fail" -eq 0 ]
