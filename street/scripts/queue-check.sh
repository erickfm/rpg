#!/bin/sh
# Do the queue's TODO rows all match what claim.sh can actually see?
#
# Twice now a rank id has made an item INVISIBLE to the dispatcher while looking
# perfectly normal in the file. The first time (GOTCHAS 60) eleven lettered rows
# read as an empty queue and four builders were spawned onto nothing. The second
# time an id of `0d2` — a digit AFTER a letter — slipped past, and this check
# caught it in seconds.
#
# Rank ids are <digits><letters>: 0a, 5b, 9e. Never 0d2.
#
# This lives in a SCRIPT, not inline in QUEUE.md, because the inline version
# matched its own pattern and reported a phantom TODO item — an instrument
# counting itself.
set -u
cd "$(dirname "$0")/.." || exit 1
t=$(grep -c '^| [0-9a-z]* | TODO |' notes/QUEUE.md); t=${t:-0}
c=$(grep -c '^| *[0-9]*[a-z]* *| *TODO *|' notes/QUEUE.md); c=${c:-0}
if [ "$t" = "$c" ]; then
  echo "queue ok — $t unclaimed, all visible to claim.sh"
else
  echo "MISMATCH: $t TODO rows, claim.sh sees $c — an item is unclaimable"
  exit 1
fi
