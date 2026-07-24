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
  local s; s=$(git -C "$1" stash create 2>/dev/null)
  [ -n "$s" ] && echo "$s" || git -C "$1" rev-parse HEAD
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
