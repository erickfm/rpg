#!/usr/bin/env bash
# Stand up a builder: worktree + node_modules symlink + a tmux window with an
# agent already briefed.
#
#   scripts/builder.sh <name> <branch> <port> "<brief>"
#   scripts/builder.sh civic feat/civic 4182 "You are builder E. Read ..."
#
# Exists because standing one up by hand went wrong twice in one session:
#
#   · launched with --permission-mode acceptEdits instead of auto, so every
#     agent stalled on a dialog after ~30 seconds of work and the desk became
#     a permission-clicking bottleneck
#   · nine panes tiled to 17 columns wide and the brief never submitted — the
#     agents sat with their instructions typed but unsent while the desk
#     reported them as working
#
# Both are handled below. Do not spawn builders by hand.
set -eu
ROOT=/home/erick/projects
MAIN=$ROOT/rpg
NAME=${1:?usage: builder.sh <name> <branch> <port> "<brief>"}
BRANCH=${2:?}
PORT=${3:?}
BRIEF=${4:?}
WT=$ROOT/rpg-$NAME

cd "$MAIN"
if [ ! -d "$WT" ]; then
  git worktree add "$WT" -b "$BRANCH"
fi
# node_modules is a SYMLINK per worktree, and .gitignore needs the
# no-trailing-slash form or the symlinks block every merge (GOTCHAS §13)
ln -sfn "$MAIN/street/node_modules" "$WT/street/node_modules"

# auto mode, always. A builder that stops to ask cannot be left alone, and the
# whole topology assumes it can.
tmux new-window -d -t crosstown -n "$NAME" -c "$WT" 'claude --permission-mode auto'

# Give the agent time to boot, then type the brief and submit it SEPARATELY —
# sending the text and the Enter in one send-keys is what silently failed.
sleep 8
tmux send-keys -t "crosstown:$NAME" "$BRIEF  Use port $PORT.  Work your queue CONTINUOUSLY - after you commit an item, rebase, re-read the queue file and take the next one immediately. Do not stop after one item. Only stop when the queue is empty or you are genuinely blocked, and say which."
sleep 1
tmux send-keys -t "crosstown:$NAME" Enter

# and prove it actually took, rather than assuming
sleep 6
if tmux capture-pane -p -t "crosstown:$NAME" | grep -qE '^\s*❯\s*[^ ]'; then
  echo "WARNING: $NAME still has text at its prompt — the brief may not have submitted."
else
  echo "$NAME: briefed on port $PORT"
fi
