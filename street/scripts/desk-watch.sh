#!/bin/sh
# Regenerate street/desk.html on a loop so the page can poll.
#
# The page reloads itself every 12s; this keeps the file underneath it current.
# Run it detached and forget it:   ./scripts/desk-watch.sh &
# Stop it:                         kill "$(cat /tmp/ct-desk-watch.pid)"
#
# It is cheap BECAUSE desk-page.mjs stats each worktree's `.git` before forking
# git at it — 62 worktrees cost about 0.1s, not 250 processes. Do not "optimise"
# by widening the interval; the cost is already in the noise.
cd "$(dirname "$0")/.." || exit 1
echo $$ > /tmp/ct-desk-watch.pid
while :; do
  node scripts/desk-page.mjs >/dev/null 2>&1
  sleep 10
done
