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
#         ./scripts/claim.sh --stale [threshold-minutes]     report DOING rows by age
#         ./scripts/claim.sh --release <item-id> [your-name] force a stuck item back to TODO
#
# A STALE CLAIM IS INDISTINGUISHABLE FROM ACTIVE WORK, AND THAT IS ITEM 9d.
# Item 9 sat `DOING w1` after the desk stopped w1 — nothing could take it and
# nothing SAID so, because claim.sh only ever reported the queue empty, never
# WHY. Same class of bug as the lettered-rank fix above: the dispatcher could
# not see its own state. Two commands, not one, because they answer different
# questions — `--stale` is read-only (is anything stuck?), `--release` acts
# (un-stick it) — and conflating them would mean a report accidentally
# mutates the very state it is reporting on.
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

mode=${1:-}
[ -z "$mode" ] && { echo "usage: claim.sh <your-name>  |  claim.sh --stale [minutes]  |  claim.sh --release <item-id> [your-name]"; exit 2; }

# ── take the lock, and never leave it behind ──────────────────────────────
# All three modes below read or rewrite the shared file, so all three need it.
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

# ── --stale: report every DOING row and its age, flag anything over the ────
# threshold (default 90 minutes — BUILDER-BRIEF's own items run smaller than
# that; GOTCHAS 18 flags a single TURN past 25 minutes with nothing
# committed, and a whole ITEM is coarser than a turn). Read-only: never
# rewrites the queue, so running it cannot itself create a stale claim.
#
# THE STAMP IS HH:MM, NO DATE (`date '+%H:%M'` at claim time) — a pre-existing
# format this does not change, only read. Minutes-since-midnight plus a
# same-day assumption is exactly right for how this fleet actually runs
# (items finish in minutes to a few hours, not days), and is wrong the moment
# a claim is genuinely more than 24h old — at which point it is obviously
# stale regardless, so the failure mode is "under-reports the age", never
# "reports fresh as stale".
if [ "$mode" = "--stale" ]; then
  threshold=${2:-90}
  # SAME CLOCK AS THE STAMP, on purpose — `date '+%s'` is UTC-based epoch
  # seconds and mixing it with the stamp's LOCAL `date '+%H:%M'` produced an
  # hours-wide phantom age on the very first sandbox run of this (a "5
  # minutes ago" claim read as 425 minutes stale). Reading now the same way
  # the stamp was written removes the timezone entirely instead of getting it
  # right once and hoping nobody moves the clock.
  now_hh=$(date '+%H'); now_mm=$(date '+%M')
  now_hh=${now_hh#0}; now_mm=${now_mm#0}
  now_min=$((now_hh * 60 + now_mm))
  rows=$(grep -n '^| *[0-9]*[a-z]* *| *DOING' "$Q")
  if [ -z "$rows" ]; then echo "no DOING rows — nothing held."; exit 0; fi
  echo "$rows" | while IFS= read -r r; do
    who_stamp=$(printf '%s' "$r" | sed 's/^[0-9]*:| *[0-9a-z]* *| *DOING \([^ ]*\) \([0-9][0-9]\):\([0-9][0-9]\).*/\1 \2 \3/')
    holder=$(printf '%s' "$who_stamp" | cut -d' ' -f1)
    hh=$(printf '%s' "$who_stamp" | cut -d' ' -f2)
    mm=$(printf '%s' "$who_stamp" | cut -d' ' -f3)
    item=$(printf '%s' "$r" | sed 's/^[0-9]*:| *\([0-9a-z]*\) *|.*/\1/')
    if [ -z "$holder" ] || [ -z "$hh" ] || [ -z "$mm" ]; then
      echo "item $item — DOING row did not match the stamp format, cannot age it: $r"
      continue
    fi
    # strip a leading zero — POSIX arithmetic reads a leading 0 as octal, and
    # "08"/"09" are not valid octal digits, so $((08)) is a hard error in
    # dash. ${v#0} is plain POSIX parameter expansion, portable everywhere.
    hh=${hh#0}; mm=${mm#0}
    claim_min=$((hh * 60 + mm))
    age=$((now_min - claim_min))
    [ "$age" -lt 0 ] && age=$((age + 1440))   # rolled past midnight
    flag=""
    if [ "$age" -ge "$threshold" ]; then flag=" — STALE (>= ${threshold}m)"; fi
    printf 'item %-4s held by %-8s for %4dm%s\n' "$item" "$holder" "$age" "$flag"
  done
  exit 0
fi

# ── --release: force a specific item back to TODO, whoever holds it ────────
# The direct fix for item 9d's own repro: the desk stopped w1 mid-item, item
# 9 stayed DOING w1 forever, and nothing else could take it or say why.
# Unlike done.sh (which only releases the item ITS OWN caller holds, by
# design — a builder cannot confirm its own work OR release someone else's
# by accident) this is explicitly for the case the holder cannot release it
# itself, so it takes an item id, not a name-matched row.
if [ "$mode" = "--release" ]; then
  item=${2:-}
  releaser=${3:-desk}
  [ -z "$item" ] && { echo "usage: claim.sh --release <item-id> [your-name]"; exit 2; }
  row=$(grep -n "^| *$item *| *DOING" "$Q" | head -1)
  if [ -z "$row" ]; then
    echo "item $item is not DOING — nothing to release (check ./scripts/claim.sh --stale for what IS held)"
    exit 1
  fi
  ln=${row%%:*}
  old=$(printf '%s' "$row" | sed 's/^[0-9]*:| *[0-9a-z]* *| *\(DOING [^|]*\) *|.*/\1/')
  sed -i "${ln}s/| *DOING [^|]* *|/| TODO |/" "$Q" || exit 1
  echo "item $item released by $releaser — was \"$old\", now TODO again"
  exit 0
fi

who=$mode

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
