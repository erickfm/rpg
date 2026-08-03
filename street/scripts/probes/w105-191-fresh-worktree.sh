#!/bin/sh
# Item 191 — THE PROOF. Delete `shots/` so the tree looks like a fresh worktree,
# then run each of the four registered checks that used to die on it, and report
# exit code plus whether ENOENT appeared anywhere in the output.
#
# BOTH SIGNS ARE REACHABLE FROM HERE: run it on this commit and expect
# "ENOENT 0" four times; run it with `git stash` over the fix and expect the
# ENOENT lines back. A run that only ever sees green cannot tell you which it
# is measuring.
#
#   SHOT_URL=http://localhost:<yours>/ sh scripts/probes/w105-191-fresh-worktree.sh
cd "$(dirname "$0")/../.." || exit 3
rm -rf shots
printf 'shots/ removed; present now: %s\n\n' "$([ -d shots ] && echo yes || echo no)"
bad=0
for f in faces masonry seampairs texdensity; do
  out=$(node "scripts/$f.mjs" 2>&1)
  code=$?
  n=$(printf '%s' "$out" | grep -c 'ENOENT')
  verdict=$(printf '%s' "$out" | tail -1 | cut -c1-72)
  [ "$n" -gt 0 ] && bad=$((bad + 1))
  printf '%-12s exit %-3s ENOENT %s   last line: %s\n' "$f" "$code" "$n" "$verdict"
done
printf '\nshots/ after the run: %s\n' "$([ -d shots ] && ls shots | wc -l || echo MISSING) file(s)"
printf '%s of 4 checks hit ENOENT\n' "$bad"
exit $bad
