#!/bin/sh
# Release the item you hold in notes/QUEUE.md and hand it to the desk to verify.
#
# Usage:  ./scripts/done.sh <your-name> "<one line on what you did>"
#
# Marks the row DONE, not CONFIRMED. **A builder never confirms its own work.**
# Every agent this week has made at least one claim that did not survive the
# desk checking it against the source — the jail landing that was never boxed
# in, the "0 of 10 files" that was 12 of 12, the pickup tyres that never clipped.
# That is not distrust; it is the only reason the quality has held.
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

who=${1:-}; shift 2>/dev/null
note=${*:-}
[ -z "$who" ] && { echo 'usage: done.sh <your-name> "<what you did>"'; exit 2; }
[ -z "$note" ] && { echo 'say what you did — the desk verifies against it'; exit 2; }

tries=0
until mkdir "$LOCK" 2>/dev/null; do
  tries=$((tries + 1))
  [ "$tries" -gt 60 ] && { rm -rf "$LOCK"; mkdir "$LOCK" 2>/dev/null || exit 1; break; }
  sleep 1
done
trap 'rm -rf "$LOCK"' EXIT INT TERM

row=$(grep -n "^| *[0-9]*[a-z]* *| *DOING $who " "$Q" | head -1)
[ -z "$row" ] && { echo "you ($who) do not hold anything — claim.sh first"; exit 3; }

ln=${row%%:*}
num=$(printf '%s' "$row" | sed 's/^[0-9]*:| *\([0-9a-z]*\) *|.*/\1/')
esc=$(printf '%s' "$note" | sed 's/[&|/\]/\\&/g')
sed -i "${ln}s/| *DOING $who [^|]*|/| DONE $who — $esc |/" "$Q" || exit 1

echo "item $num released — the desk verifies it before the LEDGER moves."
echo
echo "Before you claim the next one, make sure you have:"
echo "  · committed everything (a killed agent keeps only commits)"
echo "  · written notes/<name>-<topic>.md — root cause in one line, not 'adjusted the value'"
echo "  · said what you did NOT fix, precisely enough for the desk to queue it"
echo
echo "Now:  ./scripts/claim.sh $who"
