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
BEFORE=$(grep -c ' — \*\*AUDITOR' notes/LEDGER.md 2>/dev/null || echo 0)
git -C .. rebase "$ONTO" >/dev/null 2>&1
for _ in $(seq 1 20); do
  git -C .. status 2>/dev/null | grep -q "rebase in progress" || break
  grep -q '^<<<<<<<' notes/LEDGER.md 2>/dev/null && python3 "$PIN/ledger-merge.py" notes/LEDGER.md
  git -C .. add -A 2>/dev/null
  git -C .. -c core.editor=true rebase --continue >/dev/null 2>&1 || true
done
AFTER=$(grep -c ' — \*\*AUDITOR' notes/LEDGER.md 2>/dev/null || echo 0)
echo "auditor segments: $BEFORE before, $AFTER after"
if [ "$AFTER" -lt "$BEFORE" ]; then
  echo "** EVIDENCE LOST ($((BEFORE-AFTER)) segments). Recover with:"
  echo "   python3 $PIN/../ledger-recover.py <pre-rebase-rev>"
  exit 1
fi
echo "PASS — no evidence lost"
rm -rf "$PIN"
