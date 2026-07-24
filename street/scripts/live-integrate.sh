#!/usr/bin/env bash
# One world showing every builder's in-flight work at once.
#
# Rebuilds the `live` branch as: mainline + each worktree's CURRENT state,
# including uncommitted edits. Uses `git stash create`, which snapshots a dirty
# worktree into a commit object WITHOUT touching that worktree's index, files or
# branch — so builders never notice this is happening.
#
# Only re-integrates when something actually changed, otherwise the page would
# reload every cycle and be unplayable.
set -u
ROOT=/home/erick/projects
MAIN=$ROOT/rpg
LIVE=$ROOT/rpg-live
BASE=add-stick-and-city98
STATE=/tmp/claude-1000/-home-erick-projects-rpg/live-state
WTS=("$MAIN" "$ROOT/rpg-ground" "$ROOT/rpg-entrance" "$ROOT/rpg-alley")

snap() {  # a commit sha for the worktree's current state, dirty or not
  # NOT `git stash create`: that silently ignores UNTRACKED files, so a new
  # module a builder has written but not yet committed never reaches the live
  # world while everything importing it already does — the build breaks with
  # "cannot find module". Instead snapshot through a SEPARATE index file, so
  # the worktree's real index, files and branch are never touched.
  local wt="$1" idx
  idx=$(mktemp /tmp/ct-idx.XXXXXX)
  GIT_INDEX_FILE="$idx" git -C "$wt" read-tree HEAD 2>/dev/null
  GIT_INDEX_FILE="$idx" git -C "$wt" add -A 2>/dev/null
  local tree; tree=$(GIT_INDEX_FILE="$idx" git -C "$wt" write-tree 2>/dev/null)
  rm -f "$idx"
  if [ -n "$tree" ]; then
    git -C "$wt" commit-tree "$tree" -p "$(git -C "$wt" rev-parse HEAD)" -m wip 2>/dev/null
  else
    git -C "$wt" rev-parse HEAD
  fi
}

sigs=(); for wt in "${WTS[@]}"; do [ -d "$wt" ] && sigs+=("$(snap "$wt")"); done
sig="${sigs[*]}$(git -C "$MAIN" rev-parse $BASE)"
[ -f "$STATE" ] && [ "$(cat "$STATE")" = "$sig" ] && exit 0   # nothing moved

git -C "$LIVE" reset -q --hard "$BASE" 2>/dev/null || exit 1
merged=(); conflicted=()
i=0
for wt in "${WTS[@]}"; do
  [ -d "$wt" ] || continue
  name=$(basename "$wt")
  c="${sigs[$i]}"; i=$((i+1))
  [ "$c" = "$(git -C "$LIVE" rev-parse HEAD)" ] && continue    # adds nothing
  if git -C "$LIVE" merge -q --no-edit -m "live: $name" "$c" >/dev/null 2>&1; then
    merged+=("$name")
  else
    git -C "$LIVE" merge --abort >/dev/null 2>&1
    conflicted+=("$name")
  fi
done

echo "$sig" > "$STATE"
echo "merged: ${merged[*]:-none}${conflicted:+  CONFLICTED: ${conflicted[*]}}"
