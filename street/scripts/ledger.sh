#!/usr/bin/env bash
# What has the user asked for that is NOT yet confirmed working?
#
#   scripts/ledger.sh          everything not CONFIRMED, grouped by owner
#   scripts/ledger.sh --stats  one-line count
#
# The desk kept telling the user things were done because a builder had
# committed them. LANDED is not done. Requests came back a second and third
# time — the cars, the cat, the ATM, the shopfront glass — and every repeat
# meant the same thing: routed, assumed, never checked.
#
# So this reads notes/LEDGER.md and shows only what still owes the user
# something. Run it before saying anything is finished.
set -u
cd "$(dirname "$0")/.." || exit 1
L=notes/LEDGER.md
[ -f "$L" ] || { echo "no notes/LEDGER.md"; exit 1; }

row() { grep -E "^\| $1 \|" "$L"; }

if [ "${1:-}" = "--stats" ]; then
  printf 'CONFIRMED %s · LANDED %s · OPEN %s\n' \
    "$(row CONFIRMED | wc -l)" "$(row LANDED | wc -l)" "$(row OPEN | wc -l)"
  exit 0
fi

echo
echo "LANDED but never checked — verify these, then mark CONFIRMED:"
row LANDED | awk -F'|' '{printf "  %-3s %s\n", $3, $4}' | sed 's/  */ /g'

echo
echo "OPEN — routed, not landed:"
row OPEN | awk -F'|' '{printf "  %-3s %s\n", $3, $4}' | sed 's/  */ /g' | sort

echo
printf 'CONFIRMED %s · LANDED %s · OPEN %s\n' \
  "$(row CONFIRMED | wc -l)" "$(row LANDED | wc -l)" "$(row OPEN | wc -l)"
echo
echo "Only the desk or the auditor may set CONFIRMED — never the builder that"
echo "did the work. Evidence means someone watched it happen in the world."
echo
