#!/usr/bin/env bash
# What is still LIVE for one agent? Run this before you read your queue file.
#
#   scripts/live.sh B
#   scripts/live.sh            all agents, one block each
#
# Two builders reported the same thing on the same round: B accounted for all
# 16 unchecked items in its queue as done, void or superseded, and F took five
# consecutive items and found every one already delivered. F put the cost
# exactly: "I am spending most of each pass proving that finished work is
# finished, and a builder cannot tell a stale item from a live one by reading
# it."
#
# They are both right and the fault is the desk's, but the fix is not the desk
# promising to prune harder — it has promised that four times and the queues
# went stale again. The fix is to stop asking one file to do two jobs.
#
#   notes/LEDGER.md            IS IT STILL LIVE?   status, one row per request
#   notes/queues/<agent>.md    WHAT AM I BUILDING? the brief, the ruling, the why
#
# The ledger is the only thing the auditor updates and the only thing that
# knows a request came back CONFIRMED. So the ledger decides what is live, and
# the queue file is read for HOW rather than scanned for WHETHER. A queue item
# with no live ledger row behind it is finished work you are about to redo.
set -u
cd "$(dirname "$0")/.." || exit 1
L=notes/LEDGER.md
[ -f "$L" ] || { echo "no notes/LEDGER.md"; exit 1; }

one() {
  local a=$1 n_open n_landed
  n_open=$(grep -cE "^\| OPEN \| $a \|" "$L")
  n_landed=$(grep -cE "^\| LANDED \| $a \|" "$L")
  printf '\n=== %s — %s live, %s awaiting a check ===\n' "$a" "$n_open" "$n_landed"
  if [ "$n_open" = 0 ] && [ "$n_landed" = 0 ]; then
    echo "  nothing live. If your queue file still lists work, it is STALE —"
    echo "  say so in a note rather than building it again."
    return
  fi
  grep -E "^\| OPEN \| $a \|" "$L" | awk -F'|' '{print "  LIVE   " $4}' | sed 's/  */ /g'
  grep -E "^\| LANDED \| $a \|" "$L" | awk -F'|' '{print "  CHECK  " $4}' | sed 's/  */ /g'
}

if [ $# -ge 1 ]; then
  one "$(echo "$1" | tr '[:lower:]' '[:upper:]')"
else
  for a in A B C D E F G H AUDIT; do one "$a"; done
fi

cat <<'EOF'

LIVE  = routed to you, not landed. Build it.
CHECK = you say it is done and nobody has verified it. Do NOT re-do it and do
        NOT mark it CONFIRMED yourself — only the desk or the auditor may.

If your queue file lists something that is not here, it is finished or void.
File a one-line note naming it; do not build it a second time.
EOF
