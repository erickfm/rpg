#!/bin/sh
# w35 — re-run the stations named by the sampled CONFIRMED ledger rows, against
# the world AS IT IS NOW. Exit codes are captured directly ($? of the script,
# never of a pipeline — see BUILDER-BRIEF and the health.mjs three-status note).
: "${SHOT_URL:?set SHOT_URL to your own preview}"
OUT=${OUT:-/tmp/w35-stations}
mkdir -p "$OUT"
for s in "$@"; do
  name=$(basename "$s" .mjs)
  SHOT_URL="$SHOT_URL" node "scripts/$name.mjs" > "$OUT/$name.txt" 2>&1
  echo "$name exit=$?"
done
