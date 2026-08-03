#!/bin/sh
# Add a row to notes/QUEUE.md, under the same lock claim.sh and done.sh use.
#
# Usage:  ./scripts/add.sh [--top] <id> <files> <what>
#
# WHY THIS EXISTS. QUEUE.md says "never edit this file by hand while builders
# are running" — and then the desk had no other way to add work, so it edited it
# by hand anyway, racing five builders' claims. A rule with no tool behind it is
# a rule that gets broken by the person who wrote it.
#
# --top puts the row FIRST, which is what "rank 0" means: claim.sh takes the
# first TODO row in FILE ORDER, not the lowest id. Ids are labels for humans;
# position is what the dispatcher actually reads.
set -u
cd "$(dirname "$0")/.." || exit 1
COMMON=$(git rev-parse --git-common-dir 2>/dev/null) || COMMON=.git
case "$COMMON" in /*) ;; *) COMMON="$PWD/$COMMON";; esac
SHARED=$(dirname "$COMMON")/street/notes
# CLAIM_QUEUE is claim.sh's test hook; see the same block in done.sh for why
# this file now honours it too.
Q="${CLAIM_QUEUE:-$SHARED/QUEUE.md}"
LOCK="$(dirname "$Q")/.queue.lock"
# see scripts/queue-backup.sh, and the trap below
QB="$PWD/scripts/queue-backup.sh"
[ -f "$Q" ] || { echo "no queue at $Q"; exit 1; }

top=0
if [ "${1:-}" = "--top" ]; then top=1; shift; fi
id=${1:-}; files=${2:-}; shift 2 2>/dev/null
what=${*:-}
[ -z "$id" ] || [ -z "$files" ] || [ -z "$what" ] && {
  echo 'usage: add.sh [--top] <id> <files> <what>'; exit 2; }

case "$id" in
  [0-9]*[a-z]|[0-9]*) ;;
  *) echo "rank ids are digits then OPTIONAL letters (0a, 5b, 12) — '$id' is not"; exit 2;;
esac
grep -qE "^\| *$id *\|" "$Q" && { echo "id $id is already in the queue"; exit 2; }

tries=0
until mkdir "$LOCK" 2>/dev/null; do
  tries=$((tries + 1))
  [ "$tries" -gt 60 ] && { rm -rf "$LOCK"; mkdir "$LOCK" 2>/dev/null || exit 1; break; }
  sleep 1
done
trap 'sh "$QB" snapshot "$Q" >/dev/null 2>&1; rm -rf "$LOCK"' EXIT INT TERM

# EVERY ROW CARRIES THE MINUTE ITS NUMBERS WERE TAKEN. The user asked for this
# on 2026-08-03, and the measured reason is in the desk's own audit: of the rows
# that commented on the desk's stated cause, 28 said it was WRONG against 5 that
# said it was right. The commonest failure was not a bad guess — it was a NUMBER
# THAT HAD ROTTED. One row navigated by three figures and all three were stale:
# the backlog was 168 not 188, the worst category 14 not 39, and the single face
# it told a builder to start with NO LONGER EXISTED. Three other items turned out
# to be already satisfied.
#
# A row's prose ages gracefully; its numbers do not. Five builders can land work
# in the hour between the desk measuring something and a sixth reading about it.
# So the stamp is not decoration: it tells a builder which half of the row to
# trust. See the rule in QUEUE.md's header — numbers older than an hour are a
# HYPOTHESIS, and re-measuring is the first task, not an optional courtesy.
stamped=$(date '+%Y-%m-%d %H:%M')
row="| $id | TODO | $files | $what ⟨desk numbers measured $stamped⟩ |"
if [ "$top" = 1 ]; then
  # first line that is already a data row; insert above it
  first=$(grep -nE '^\| *[0-9]+[a-z]* *\|' "$Q" | head -1 | cut -d: -f1)
  if [ -n "$first" ]; then
    awk -v n="$first" -v r="$row" 'NR==n{print r} {print}' "$Q" > "$Q.tmp" && mv "$Q.tmp" "$Q"
  else
    printf '%s\n' "$row" >> "$Q"
  fi
else
  last=$(grep -nE '^\| *[0-9]+[a-z]* *\|' "$Q" | tail -1 | cut -d: -f1)
  if [ -n "$last" ]; then
    awk -v n="$last" -v r="$row" '{print} NR==n{print r}' "$Q" > "$Q.tmp" && mv "$Q.tmp" "$Q"
  else
    printf '%s\n' "$row" >> "$Q"
  fi
fi
echo "added item $id$([ "$top" = 1 ] && echo ' at the TOP')"
