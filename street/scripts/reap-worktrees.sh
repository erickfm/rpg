#!/bin/sh
# Remove agent worktrees that are finished, and prune the branches behind them.
#
# Usage:  ./scripts/reap-worktrees.sh [--dry]
#
# WHY A SCRIPT. The desk hand-wrote this loop on nearly every tick, slightly
# differently each time, and one of those versions came within a `locked` flag of
# deleting a worktree out from under a builder that was still working in it. It
# survived because `git worktree remove` refuses a locked worktree — the desk was
# relying on a FAILURE rather than making a check. That is the same shape as
# every instrument bug found tonight: the safe outcome happened for a reason
# nobody had written down.
#
# THREE CONDITIONS, ALL REQUIRED, checked explicitly:
#   1. not locked          — a live agent's worktree is locked by the harness
#   2. clean               — no uncommitted work to lose
#   3. nothing unlanded    — every commit is already on the base branch
#
# Anything failing one of these is KEPT and the reason printed, because "I did
# not remove this and here is why" is the useful output. Silence would leave the
# desk unable to tell "nothing to do" from "the loop is broken".
set -u
cd "$(dirname "$0")/.." || exit 1
BASE=${WORKTREE_BASE:-add-stick-and-city98}
DRY=0
[ "${1:-}" = "--dry" ] && DRY=1

kept=0; gone=0
for w in $(git worktree list --porcelain | awk '/^worktree .*agent-/{print $2}'); do
  id=$(basename "$w" | sed 's/^agent-//')
  br="worktree-agent-$id"

  if git worktree list --porcelain | grep -A3 "^worktree $w\$" | grep -q '^locked'; then
    echo "keep $id — LOCKED (an agent is live in it)"; kept=$((kept + 1)); continue
  fi
  dirty=$(git -C "$w" status --short 2>/dev/null | wc -l)
  if [ "$dirty" -ne 0 ]; then
    echo "keep $id — $dirty uncommitted file(s)"; kept=$((kept + 1)); continue
  fi
  ahead=$(git log --oneline "$BASE..$br" 2>/dev/null | wc -l)
  if [ "$ahead" -ne 0 ]; then
    echo "keep $id — $ahead commit(s) not on $BASE (land them first)"; kept=$((kept + 1)); continue
  fi

  if [ "$DRY" = 1 ]; then
    echo "would remove $id"
  else
    git worktree remove "$w" 2>/dev/null && { git branch -d "$br" >/dev/null 2>&1; gone=$((gone + 1)); } \
      || { echo "keep $id — git refused to remove it"; kept=$((kept + 1)); }
  fi
done

[ "$DRY" = 1 ] && { echo "(dry run — $kept kept)"; exit 0; }
echo "removed $gone, kept $kept"
echo "worktrees now: $(git worktree list | wc -l), branches: $(git branch | wc -l)"
