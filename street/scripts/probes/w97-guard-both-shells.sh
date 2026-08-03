#!/bin/sh
# Item 247. The one step item 243 missed: run the guard FROM THE SHARED CHECKOUT
# in both roles, from real shells, and print the exit code of the COMMAND.
#
# Read-only. It runs the guard, never `npm install` or `npm run build`, so it
# cannot touch the tree it is standing in.
#
# ⚠ THE CALLER MUST HAVE ALREADY `cd`-ed INTO THE SHARED CHECKOUT, in the real
# shell, before invoking this. That is not a formality — it is the whole
# measurement. The first version of this probe cd-ed internally and reported the
# DESK REFUSED, which was the probe lying: the outer shell was still standing in
# the agent worktree, so the guard's ancestor-cwd witness (correctly) saw a
# builder. GOTCHAS 48 in a new hat. Invoke it as:
#
#   cd /home/erick/projects/rpg/street && sh <this> role1 <abs path to guard>
#   cd /home/erick/projects/rpg/street && sh <this> role2 <abs path to guard>
#
# role1 -- THIS spawned builder, exactly as it stands: OLDPWD is its own
#          worktree, because the harness resets an agent's cwd before every Bash
#          call and it had to `cd` to get here.  EXPECT exit 1.
# role2 -- THE DESK: identical process tree (the desk's shell and a builder's are
#          both direct children of pid 282161) and identical CLAUDE_* env; the
#          one faithful difference is OLDPWD=/home/erick/projects/rpg, the value
#          read from the desk's own live :5177 shell (pid 370039).
#          EXPECT exit 0.
ROLE=$1
GUARD=$2
[ -n "$GUARD" ] || { echo "usage: cd <shared street> && sh $0 role1|role2 <abs guard path>"; exit 2; }

echo "cwd:    $(pwd)"
echo "OLDPWD: $OLDPWD"
echo

if [ "$ROLE" = role2 ]; then
  echo "--- role 2: the desk (OLDPWD forced to /home/erick/projects/rpg, the real desk value)"
  OLDPWD=/home/erick/projects/rpg node "$GUARD" 'npm run build'
  echo "EXIT=$?"
else
  echo "--- role 1: this spawned builder, untouched env"
  node "$GUARD" 'npm run build'
  echo "EXIT=$?"
fi
