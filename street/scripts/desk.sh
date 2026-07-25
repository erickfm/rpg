#!/usr/bin/env bash
# The desk's one status command. Answers, for every agent at once:
#
#   is it actually working, or has it been idle waiting for me?
#   has it committed work that I have not landed?
#   has it reported something I have not read?
#   is its queue stale — items still open that are already on mainline?
#
# Every one of those went wrong in a single session, and each time the desk
# reported the opposite to the user in good faith:
#
#   · eleven commits sat finished across seven worktrees while mainline had
#     none of them, because the merge train was never run
#   · six agents sat DONE for up to twenty minutes while the desk reported
#     them as working. Their input boxes showed placeholder HINT text, which
#     reads exactly like a queued message in a screenshot of a pane
#   · two builders' queues listed items as pending that had landed hours
#     earlier; the desk had been routing new work into files it had stopped
#     maintaining, and told the user a builder was blocked when it was not
#
# So this file prints ACTION lines, not a dashboard. If it says nothing under
# ACTIONS, there is nothing for the desk to do.
#
# Usage:  scripts/desk.sh          status + actions
#         scripts/desk.sh --land   ...and run the merge train if anything is landable
set -u
ROOT=/home/erick/projects
MAIN=$ROOT/rpg
BASE=add-stick-and-city98
SESSION=crosstown
DO_LAND=${1:-}

cd "$MAIN" || exit 1

# ── is this agent working? ────────────────────────────────────────────────
#
# NOT by looking at its input box. Claude Code renders a greyed-out SUGGESTION
# in the box when idle — "do the church move", "keep going, next item" — and in
# a captured pane that is indistinguishable from a message the user typed and
# left unsent. The desk read six of those as queued input and pressed Enter on
# an empty box six times.
#
# The honest signal is the spinner / interrupt hint, which only renders while
# the agent is actually running. Match a TRUNCATION-SAFE prefix: panes are
# often narrow enough to cut "esc to interrupt" mid-word.
busy() {
  tmux capture-pane -p -t "$SESSION:$1" 2>/dev/null \
    | grep -qE 'esc to inter|…[[:space:]]*\((thinking|[0-9]+[ms])'
}
blocked() {
  tmux capture-pane -p -t "$SESSION:$1" 2>/dev/null | grep -q 'Do you want to proceed'
}

declare -a ACTIONS=()
printf '%-14s %-8s %-7s %-7s %s\n' AGENT STATE UNLANDED DIRTY QUEUE
printf -- '------------------------------------------------------------------------\n'

for wt in "$ROOT"/rpg-*; do
  [ -d "$wt" ] || continue
  name=$(basename "$wt")
  case "$name" in rpg-live) continue;; esac
  short=${name#rpg-}

  br=$(git -C "$wt" rev-parse --abbrev-ref HEAD 2>/dev/null) || continue
  ahead=$(git -C "$wt" log --oneline "$BASE..$br" 2>/dev/null | wc -l | tr -d ' ')
  dirty=$(git -C "$wt" status --porcelain 2>/dev/null | grep -vc node_modules)

  # find its tmux window by the path it is sitting in
  win=$(tmux list-panes -a -F '#{window_index} #{pane_current_path}' 2>/dev/null \
        | awk -v p="$wt" '$2==p {print $1; exit}')

  if [ -z "$win" ]; then state=NO-AGENT
  elif blocked "$win"; then state=BLOCKED
  elif busy "$win"; then state=busy
  else state=IDLE
  fi

  # queue depth for whichever queue file names this worktree
  qf=$(grep -ls "worktree \`../$name\`" "$MAIN"/street/notes/queues/*.md 2>/dev/null | head -1)
  qopen=$( [ -n "$qf" ] && grep -c '^- \[ \]' "$qf" || echo '?' )

  printf '%-14s %-8s %-7s %-7s %s\n' "$short" "$state" "$ahead" "$dirty" "$qopen"

  [ "$state" = BLOCKED ] && ACTIONS+=("$short is BLOCKED on a permission dialog — answer it (tmux window $win)")
  [ "$state" = IDLE ] && [ "$qopen" != 0 ] && [ "$qopen" != '?' ] \
    && ACTIONS+=("$short is IDLE with $qopen items queued — dispatch it (tmux window $win)")
  [ "$state" = IDLE ] && [ "$qopen" = 0 ] \
    && ACTIONS+=("$short is IDLE and OUT OF WORK — give it a queue or retire it")
  [ "$ahead" -gt 0 ] && [ "$dirty" -eq 0 ] \
    && ACTIONS+=("$short has $ahead unlanded commits and a clean tree — run scripts/land.sh")
  # dirty is only a problem when the agent is NOT working — a busy agent is
  # supposed to have a dirty tree. Dirty AND idle means finished-but-uncommitted,
  # which is invisible to the user and gets skipped by the merge train.
  [ "$dirty" -gt 0 ] && [ "$state" = IDLE ] \
    && ACTIONS+=("$short is IDLE with $dirty uncommitted files — finished but never committed; land.sh will skip it")

  # a report newer than the queue file means the builder has told the desk
  # something the desk has not folded in. This is exactly how queues went stale.
  if [ -n "$qf" ]; then
    for rep in "$MAIN"/street/notes/*"$short"*.md; do
      [ -f "$rep" ] || continue
      [ "$rep" -nt "$qf" ] && ACTIONS+=("$short: $(basename "$rep") is NEWER than its queue — read it, the queue may be stale")
    done
  fi
done

echo
if [ ${#ACTIONS[@]} -eq 0 ]; then
  echo "ACTIONS: none. Every agent is working, everything green is landed."
else
  echo "ACTIONS:"
  printf '  ! %s\n' "${ACTIONS[@]}"
fi
echo

if [ "$DO_LAND" = "--land" ]; then
  echo "── merge train ──"
  "$MAIN/street/scripts/land.sh"
fi
