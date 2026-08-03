#!/bin/sh
# Mark a TODO row SUPERSEDED, under the same lock claim.sh, done.sh and add.sh use.
#
# Usage:  ./scripts/supersede.sh <old-id> <new-id>
#
# WHY THIS EXISTS. `SUPERSEDED by N` is already the queue's convention — rows
# 195 and 203 carry it and `claim.sh` only ever takes rows whose status is
# exactly `TODO`, so it is the one status that reliably takes a row out of
# circulation. **There was no tool that could write it.** add.sh's own header
# says the desk had no way to ADD work and so edited QUEUE.md by hand, racing
# five builders' claims — *"a rule with no tool behind it is a rule that gets
# broken by the person who wrote it."* Retiring a row was the same hole: worker
# seventyseven re-scoped item 202 into 202c for item 202b and could add the new
# row but not retire the old one, which would have left a row with a MEASURED-
# WRONG diagnosis sitting TODO for the next builder to claim. That is the exact
# waste 202b existed to prevent.
#
# It refuses on anything but a TODO row on purpose: a DOING row belongs to a
# live builder and taking it out from under them is worse than the duplicate.
set -u
cd "$(dirname "$0")/.." || exit 1
COMMON=$(git rev-parse --git-common-dir 2>/dev/null) || COMMON=.git
case "$COMMON" in /*) ;; *) COMMON="$PWD/$COMMON";; esac
SHARED=$(dirname "$COMMON")/street/notes
# CLAIM_QUEUE is claim.sh's test hook; honoured here for the same reason.
Q="${CLAIM_QUEUE:-$SHARED/QUEUE.md}"
LOCK="$(dirname "$Q")/.queue.lock"
QB="$PWD/scripts/queue-backup.sh"
[ -f "$Q" ] || { echo "no queue at $Q"; exit 1; }

old=${1:-}; new=${2:-}
[ -z "$old" ] || [ -z "$new" ] && { echo 'usage: supersede.sh <old-id> <new-id>'; exit 2; }
for id in "$old" "$new"; do
  case "$id" in
    [0-9]*[a-z]|[0-9]*) ;;
    *) echo "rank ids are digits then OPTIONAL letters (0a, 5b, 12) — '$id' is not"; exit 2;;
  esac
done
[ "$old" = "$new" ] && { echo "a row cannot supersede itself"; exit 2; }
grep -qE "^\| *$new *\|" "$Q" || { echo "id $new is not in the queue — add it BEFORE retiring $old"; exit 2; }

tries=0
until mkdir "$LOCK" 2>/dev/null; do
  tries=$((tries + 1))
  [ "$tries" -gt 60 ] && { rm -rf "$LOCK"; mkdir "$LOCK" 2>/dev/null || exit 1; break; }
  sleep 1
done
trap 'sh "$QB" snapshot "$Q" >/dev/null 2>&1; rm -rf "$LOCK"' EXIT INT TERM

# re-read the status INSIDE the lock — outside it, it is a guess
line=$(grep -nE "^\| *$old *\|" "$Q" | head -1 | cut -d: -f1)
[ -z "$line" ] && { echo "id $old is not in the queue"; exit 2; }
status=$(sed -n "${line}p" "$Q" | awk -F'|' '{print $3}' | sed 's/^ *//; s/ *$//')
case "$status" in
  TODO) ;;
  *) echo "$old is '$status', not TODO — refusing. A DOING row belongs to a live builder; a DONE or already-SUPERSEDED row is out of circulation already."; exit 2;;
esac

# FS and OFS are both "|", so assigning $3 rebuilds the line with every other
# character untouched — including any pipes further along the row, because a
# split and a re-join on the same separator is lossless. Hand-slicing with
# substr() was the first version and it left the old status in the tail.
awk -F'|' -v OFS='|' -v n="$line" -v new="$new" \
  'NR==n{$3=" SUPERSEDED by " new " "} {print}' "$Q" > "$Q.tmp" && mv "$Q.tmp" "$Q"

echo "item $old is now SUPERSEDED by $new (was TODO, line $line)"
