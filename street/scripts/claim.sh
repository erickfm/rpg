#!/bin/sh
# Claim the top unclaimed item in notes/QUEUE.md, atomically.
#
# The user: *"as a builder finishes one task they pick up another."* This is the
# whole mechanism. A builder runs it, gets one item, does it, runs done.sh, runs
# this again. Nobody waits to be told.
#
# WHY A LOCK. Builders run concurrently. Read-modify-write on a shared file
# without one gives two builders the same item, and this project has already
# paid for two agents in one file: a corrupted worktree and a broken live world
# (PARALLEL-WORKFLOW §11). `mkdir` is the atomic primitive available in sh —
# it succeeds for exactly one caller.
#
# Usage:  ./scripts/claim.sh <your-name>
set -u
cd "$(dirname "$0")/.." || exit 1
# THE QUEUE IS SHARED, AND IT MUST NOT LIVE IN GIT.
#
# First cut kept it at notes/QUEUE.md. That is tracked, so every worktree gets
# its OWN copy — a builder claimed item 1 in its worktree, the main tree still
# read TODO, and a second builder would have claimed the same item. The mkdir
# lock was guarding a file nobody else could see. Caught within ten minutes of
# shipping it, by watching a real worker.
#
# So both scripts resolve to ONE path outside every worktree. `git rev-parse
# --git-common-dir` points at the shared .git for the whole repo, worktrees
# included, which is exactly the scope the queue needs.
COMMON=$(git rev-parse --git-common-dir 2>/dev/null) || COMMON=.git
case "$COMMON" in /*) ;; *) COMMON="$PWD/$COMMON";; esac
SHARED=$(dirname "$COMMON")/street/notes
Q="$SHARED/QUEUE.md"
LOCK="$SHARED/.queue.lock"
[ -f "$Q" ] || { echo "no queue at $Q"; exit 1; }

who=${1:-}
[ -z "$who" ] && { echo "usage: claim.sh <your-name>"; exit 2; }

# ── take the lock, and never leave it behind ──────────────────────────────
tries=0
until mkdir "$LOCK" 2>/dev/null; do
  tries=$((tries + 1))
  if [ "$tries" -gt 60 ]; then
    # A dead builder's lock must not stop the queue forever.
    echo "queue locked for 60s — assuming a dead holder and taking it"
    rm -rf "$LOCK"; mkdir "$LOCK" 2>/dev/null || exit 1
    break
  fi
  sleep 1
done
trap 'rm -rf "$LOCK"' EXIT INT TERM

# ── the top TODO row, if any ──────────────────────────────────────────────
# `[0-9]*` MISSED EVERY LETTERED RANK. The desk inserts urgent items as 0a, 5b,
# 6b … so a new item can jump the queue without renumbering rows other builders
# are holding. That is a good scheme and this pattern could not see any of them:
# eleven TODO items, all lettered, and claim.sh reported the queue EMPTY. Four
# builders were spawned onto nothing. Match a digit-run with an optional letter.
row=$(grep -n '^| *[0-9]*[a-z]* *| *TODO *|' "$Q" | head -1)
if [ -z "$row" ]; then
  held=$(grep -c '^| *[0-9]*[a-z]* *| *DOING' "$Q" 2>/dev/null); held=${held:-0}
  echo "QUEUE EMPTY — nothing unclaimed."
  [ "$held" -gt 0 ] && echo "($held item(s) still held by other builders.)"
  echo "Say so and stop. Do not invent work."
  exit 3
fi

ln=${row%%:*}
num=$(printf '%s' "$row" | sed 's/^[0-9]*:| *\([0-9a-z]*\) *|.*/\1/')

# mark it DOING, stamped with who and when — one sed, inside the lock
stamp="DOING $who $(date '+%H:%M')"
sed -i "${ln}s/| *TODO *|/| $stamp |/" "$Q" || exit 1

echo "=== claimed item $num ==="
sed -n "${ln}p" "$Q" | sed 's/^| *[0-9a-z]* *| *[^|]* *|/  file(s):/' | sed 's/ *| */\n  /'
echo
echo "  Rules for HOW: notes/BUILDER-BRIEF.md (read it once)"
echo "  Your port:     pick a free one in 4180-4199, and always pass SHOT_URL"
echo "  When finished: ./scripts/done.sh $who \"<one line on what you did>\""
echo "  Then claim again. Commit as you go — killed agents keep only commits."
