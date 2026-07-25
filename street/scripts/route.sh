#!/usr/bin/env bash
# Route a user request to a builder: LOG it, DISPATCH it, VERIFY it took.
#
#   scripts/route.sh <agent> "<the user's own words>" "<message to the agent>"
#   scripts/route.sh B "make rain cause some puddles" "New top item: ..."
#
# The three steps are one command because the desk skipped the first one.
# CLAUDE.md requires every request to be logged to FEATURE-REQUESTS.md; during
# a fast stretch the desk routed ~20 asks straight into queue files and the
# master record simply stopped, so the only trace was scattered across nine
# queues and commit messages. Nothing was lost, but nothing could be
# reconstructed either. Now you cannot dispatch without logging.
#
# It also verifies the dispatch landed. Two separate failures came from
# assuming it had: a brief typed into a prompt but never submitted (eight
# agents idle while the desk reported them working), and a "drop everything"
# dispatch that the desk never checked, leaving three finished rooms out of
# the world for another hour.
set -u
MAIN=/home/erick/projects/rpg
SESSION=crosstown
AGENT=${1:?usage: route.sh <agent-letter-or-name> "<user quote>" "<dispatch message>"}
QUOTE=${2:?}
MSG=${3:?}

cd "$MAIN" || exit 1

# resolve the agent to its queue file and tmux window
QF=$(ls street/notes/queues/ | grep -i "^${AGENT}[-.]" | head -1)
[ -z "$QF" ] && { echo "no queue file matches agent '$AGENT'"; exit 1; }
WT=$(grep -o 'worktree `\.\./[a-z0-9-]*`' "street/notes/queues/$QF" | head -1 | sed 's/.*\.\.\///;s/`//')
WIN=$(tmux list-panes -a -F '#{window_index} #{pane_current_path}' 2>/dev/null \
      | awk -v p="/home/erick/projects/$WT" '$2==p {print $1; exit}')
[ -z "$WIN" ] && { echo "no tmux window found for $WT"; exit 1; }

# 1. LOG — into the Inbox, with the routing, in the user's own words
python3 - "$QUOTE" "$AGENT" <<'PY'
import sys, re
quote, agent = sys.argv[1], sys.argv[2]
p = '/home/erick/projects/rpg/street/FEATURE-REQUESTS.md'
s = open(p).read()
line = f'- **"{quote}"** → **{agent}**\n'
m = re.search(r'^## Inbox\n', s, re.M)
s = s[:m.end()] + line + s[m.end():]
open(p, 'w').write(s)
PY
echo "logged: \"$QUOTE\" -> $AGENT"

# 2. DISPATCH — text and Enter SEPARATELY. Sending them together silently
#    fails: the text lands in the box and the Enter does not register.
tmux send-keys -t "$SESSION:$WIN" C-u; sleep 0.4
tmux send-keys -t "$SESSION:$WIN" "$MSG"; sleep 1
tmux send-keys -t "$SESSION:$WIN" Enter

# 3. VERIFY — an empty prompt and a running spinner. Anything else is a
#    dispatch that did not take, and the desk should know now, not in an hour.
sleep 6
PANE=$(tmux capture-pane -p -t "$SESSION:$WIN")
# Claude Code prints its own hints at the prompt — "Press up to edit queued
# messages", greyed-out suggestions — and they are NOT user text. Matching them
# produced false "did not submit" warnings on dispatches that had in fact gone
# through, which is the mirror image of the bug this check exists to catch.
if echo "$PANE" | grep -qE '^\s*❯\s*\S' \
   && ! echo "$PANE" | grep -qE '^\s*❯\s*(Press up to edit|Try |Ask )'; then
  echo "WARNING: $AGENT still has text at its prompt — the dispatch may not have submitted."
elif echo "$PANE" | grep -qE 'esc to inter|…[[:space:]]*\((thinking|[0-9]+[ms])'; then
  echo "dispatched: $AGENT (window $WIN) is working"
else
  echo "WARNING: $AGENT is not showing a spinner — check window $WIN."
fi
