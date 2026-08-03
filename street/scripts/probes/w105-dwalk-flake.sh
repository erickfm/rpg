#!/bin/sh
# Item 261 — how often does D-walk's bodega leg lose the cereal counter?
#
# NOT A LEG I TOUCHED, and that is the point of measuring it separately. The
# counter is found by a spiral search out from the shop door (D-walk.mjs:335,
# r = 0.75 … 3.75 in 0.75 steps, 16 headings), and one run in this session came
# back "not found within 3.75 m" on a world where every other run found it at
# (522.3, 4.9). Converting the money assertions below it does not touch the
# search, so this exists to hand the desk a RATE rather than an anecdote.
#   SHOT_URL=http://localhost:<yours>/ sh scripts/probes/w105-dwalk-flake.sh
cd "$(dirname "$0")/../.." || exit 3
i=1
while [ "$i" -le "${N:-5}" ]; do
  out=$(node scripts/D-walk.mjs 2>&1)
  printf 'run %d  %s\n' "$i" \
    "$(printf '%s' "$out" | grep -E 'cereal counter is findable' | sed 's/^ *//')"
  printf '        %s\n' "$(printf '%s' "$out" | grep -cE '^ *FAIL') FAIL line(s) overall"
  i=$((i + 1))
done
