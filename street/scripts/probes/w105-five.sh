#!/bin/sh
# Five runs of w105-purse-hook, because one green run of a hook check is not a
# spread — BUILDER-BRIEF §10 and the desk's standing "five runs, report the
# spread". Prints only the verdict line and the summary from each.
#   SHOT_URL=http://localhost:<yours>/ sh scripts/probes/w105-five.sh
for i in 1 2 3 4 5; do
  out=$(node "$(dirname "$0")/w105-purse-hook.mjs" 2>&1)
  code=$?
  printf 'run %d  exit %d  %s  %s\n' "$i" "$code" \
    "$(printf '%s' "$out" | grep -E '^[0-9]+/[0-9]+ passed')" \
    "$(printf '%s' "$out" | grep -E '^SUMMARY')"
done
