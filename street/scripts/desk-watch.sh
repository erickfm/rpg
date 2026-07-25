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
  # surface idle agents; the desk has to decide what they do next
  idle=$("$MAIN/street/scripts/desk.sh" 2>/dev/null | grep -E 'is IDLE|is BLOCKED')
  [ -n "$idle" ] && { echo "[$ts] NEEDS THE DESK:"; echo "$idle"; }
  sleep "$INTERVAL"
done
