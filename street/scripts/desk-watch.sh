#!/usr/bin/env bash
# Runs the merge train on a loop so finished work cannot sit unlanded.
#
# The desk having a status command is not enough — the failure was never that
# the desk looked and misread. It was that the desk did not look. Eleven
# commits sat finished across seven worktrees for the better part of an hour
# because nobody ran `land.sh`, and the user experienced that as "seems slow".
#
# So landing is automatic. It is already safe to automate: land.sh refuses to
# run if mainline is broken, rebases each builder, typechecks after EVERY merge
# so a break is attributed to the builder that caused it, and reverts any
# builder that breaks the build. There is no judgement call in it.
#
# What is NOT automated is dispatching an idle agent — that needs a human or
# the desk to decide what it works on next. So idle agents are logged loudly
# for the desk to pick up.
#
#   nohup street/scripts/desk-watch.sh > /tmp/desk-watch.log 2>&1 &
set -u
MAIN=/home/erick/projects/rpg
INTERVAL=${1:-120}

while true; do
  ts=$(date '+%H:%M:%S')
  out=$("$MAIN/street/scripts/land.sh" 2>&1)
  if echo "$out" | grep -q '✓'; then
    echo "[$ts] LANDED:"
    echo "$out" | grep '✓'
  fi
  if echo "$out" | grep -q '✗'; then
    echo "[$ts] SKIPPED:"
    echo "$out" | grep '✗'
  fi
  # Idle agents with queued work get nudged back onto their queue automatically.
  #
  # "Work your queue continuously" only survives the turn it is sent in: an
  # agent finishes an item, ends its turn, and waits. Six of nine were found
  # idle twice in one session with sixty items between them and last commits
  # twenty minutes old, while the user was waiting on that exact work. A human
  # deciding what each should do next is NOT required here — the queue file
  # already says, and the desk wrote it.
  #
  # Only agents with a non-zero queue are nudged. An agent that is genuinely
  # out of work is surfaced for the desk instead, because giving it something
  # to do is a real decision.
  status=$("$MAIN/street/scripts/desk.sh" 2>/dev/null)

  # A DEAD agent is restarted automatically. Its queue file holds the whole
  # brief, so bringing the session back costs nothing and losing an hour of a
  # builder's output does. Two sessions exited during one stretch and the desk
  # read both as "idle" — a dead window and a resting one look identical to
  # every other check here.
  echo "$status" | grep -E 'SESSION HAS EXITED' | while read -r line; do
    win=$(echo "$line" | grep -oE 'window [0-9]+' | grep -oE '[0-9]+')
    who=$(echo "$line" | awk '{print $2}')
    [ -z "$win" ] && continue
    echo "[$ts] RESTARTING $who — its session had exited (window $win)"
    tmux send-keys -t "crosstown:$win" "claude --permission-mode auto"; sleep 0.5
    tmux send-keys -t "crosstown:$win" Enter
    sleep 12
    tmux send-keys -t "crosstown:$win" "Your previous session exited. Read street/START-HERE.md, street/notes/GOTCHAS.md and your queue file in street/notes/queues/, then rebase on add-stick-and-city98 and work your queue continuously. Check street/notes/LEDGER.md for the user requests that are still OPEN against you."
    sleep 1
    tmux send-keys -t "crosstown:$win" Enter
  done
  echo "$status" | grep -E 'IDLE with [0-9]+ queued' | while read -r line; do
    win=$(echo "$line" | grep -oE 'window [0-9]+' | grep -oE '[0-9]+')
    who=$(echo "$line" | awk '{print $2}')
    [ -z "$win" ] && continue
    echo "[$ts] nudging $who (window $win) back onto its queue"
    tmux send-keys -t "crosstown:$win" C-u; sleep 0.3
    tmux send-keys -t "crosstown:$win" "Rebase on add-stick-and-city98, re-read your queue file, and take the next item. Work continuously — after each commit, rebase, re-read and take the next one. Only stop when your queue is empty or you are genuinely blocked, and if blocked write street/notes/BLOCKED-<you>.md and take the next item instead."
    sleep 0.8
    tmux send-keys -t "crosstown:$win" Enter
    sleep 0.5
  done
  # The ledger is the user-facing truth. Surfacing it here means the desk sees
  # the CONFIRMED/LANDED/OPEN counts every cycle rather than discovering at the
  # end of a session that a dozen things were finished and never checked.
  "$MAIN/street/scripts/ledger.sh" --stats 2>/dev/null | sed "s/^/[$ts] ledger: /"

  # things that still need a human decision
  needs=$(echo "$status" | grep -E 'is BLOCKED|OUT OF WORK|STALLED|CONTEXT LIMIT|RAISED A BLOCKER')
  [ -n "$needs" ] && { echo "[$ts] NEEDS THE DESK:"; echo "$needs"; }
  sleep "$INTERVAL"
done
