#!/usr/bin/env bash
# Refresh the live world ONCE, on demand. Then reload the browser yourself.
#
#   street/scripts/pull-latest.sh
#
# The integrator used to run on a loop every 15-45 s. With nine builders
# committing continuously the world genuinely changed almost every cycle, so
# Vite reloaded the page almost every cycle, and the user reported the world
# "restarts on a loop, making it unplayable" and then "why does the game
# refresh like every minute".
#
# Both were right, and they are different faults:
#
#   · the FIRST was spurious — `commit-tree` mints a new SHA every cycle from
#     the timestamp alone, so the "nothing moved" check never fired and the
#     branch was rewritten even when nothing had changed. Fixed by signing on
#     trees rather than commits.
#   · the SECOND is not a bug at all. Nine agents landing work means the world
#     really is different a minute later. A loop that always shows you the
#     newest world is exactly a loop that never lets you stand still in one.
#
# So the loop is off while the user plays, and this is the manual pull. You
# decide when the world changes under you, which is the only sane arrangement
# for a playtest.
#
# To go back to continuous integration (for a long unattended run):
#   while true; do street/scripts/live-integrate.sh; sleep 120; done &
set -u
cd "$(dirname "$0")/../.." || exit 1
before=$(git -C ../rpg-live rev-parse HEAD 2>/dev/null)
./street/scripts/live-integrate.sh
after=$(git -C ../rpg-live rev-parse HEAD 2>/dev/null)

if [ "$before" = "$after" ]; then
  echo "no change — the world you are looking at is already current"
else
  echo "live world updated. Reload the browser tab to pick it up."
  git -C ../rpg-live log --oneline -1 | cat
fi
