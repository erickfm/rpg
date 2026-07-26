#!/usr/bin/env bash
# Rebase onto mainline, resolving LEDGER.md conflicts with PINNED tools.
#
# WHY PINNED. The obvious loop - "if conflicted, run scripts/ledger-merge.py" -
# is wrong in a way that took me three losses to see: during a rebase the
# working tree holds whatever the replay has reached, so `scripts/ledger-merge.py`
# is the version from the commit being replayed. I fixed a bug in that resolver
# and the very next rebase still used the OLD copy for every commit before the
# fix, and lost four passes of evidence again.
#
# A tool that the operation is itself rewriting cannot be trusted mid-operation.
# Copy it out first, then drive.
set -u
cd "$(dirname "$0")/.."
ONTO="${1:-add-stick-and-city98}"
PIN=$(mktemp -d)
cp scripts/ledger-merge.py "$PIN/" || exit 1
echo "pinned resolver -> $PIN/ledger-merge.py"
# FINGERPRINT EACH SEGMENT, do not count them. A total nets out: this guard
# said "73 before, 73 after" while a rebase dropped my library-stair
# confirmation, because mainline added an auditor segment elsewhere in the same
# rebase. A conservation check that only conserves a SUM cannot see a swap.
fp(){ grep -o ' — \*\*AUDITOR[^*]\{0,60\}' "$1" 2>/dev/null | sort; }
BEFORE_F=$(mktemp); fp notes/LEDGER.md > "$BEFORE_F"
BEFORE=$(wc -l < "$BEFORE_F")
git -C .. rebase "$ONTO" >/dev/null 2>&1
for _ in $(seq 1 20); do
  git -C .. status 2>/dev/null | grep -q "rebase in progress" || break
  grep -q '^<<<<<<<' notes/LEDGER.md 2>/dev/null && python3 "$PIN/ledger-merge.py" notes/LEDGER.md
  git -C .. add -A 2>/dev/null
  git -C .. -c core.editor=true rebase --continue >/dev/null 2>&1 || true
done
AFTER_F=$(mktemp); fp notes/LEDGER.md > "$AFTER_F"
AFTER=$(wc -l < "$AFTER_F")
MISSING=$(comm -23 "$BEFORE_F" "$AFTER_F")
echo "auditor segments: $BEFORE before, $AFTER after"
if [ -n "$MISSING" ]; then
  echo "** EVIDENCE LOST — these segments are gone, whatever the totals say:"
  echo "$MISSING" | sed 's/^/     /'
  echo "   recover with: python3 $PIN/ledger-recover.py <pre-rebase-rev>"
  rm -f "$BEFORE_F" "$AFTER_F"
  exit 1
fi
rm -f "$BEFORE_F" "$AFTER_F"
echo "PASS — every segment that was there is still there"
rm -rf "$PIN"
