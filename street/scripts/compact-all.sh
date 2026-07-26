#!/usr/bin/env bash
# Compact every agent WITHOUT losing what it was doing.
#
#   scripts/compact-all.sh          all agents
#   scripts/compact-all.sh C K      just those
#
# The user asked for this directly: *"everyone might need a context
# compression. i want to keep hallucinations down and performance up."* Both
# halves are real — a long context degrades recall and invents detail, and this
# fleet has produced several confident wrong answers late in a session that the
# same agent would not have made fresh.
#
# THE RISK IS LOSING THE CURRENT ITEM, NOT THE PROJECT. The project survives a
# compaction because it is written down: OWNERSHIP.md says what you own,
# LEDGER.md says what is live, the queue file says how, GOTCHAS.md says what
# bites. What does NOT survive is the half-finished reasoning on the item in
# hand — which is exactly what `notes/status/<agent>` records, one line, kept
# current.
#
# So the carry-forward is assembled from what the agent already published about
# itself. No agent is told anything it did not write down, which is also a test
# of whether the status discipline was real.
#
# COMMIT FIRST. A compaction does not touch the working tree, but an agent that
# forgets what it was mid-edit on will leave it there uncommitted, and land.sh
# skips a dirty worktree. So each agent is asked to commit before compacting.
set -u
MAIN=/home/erick/projects/rpg
SESSION=crosstown
cd "$MAIN" || exit 1

want=("$@")
sent=0

for qf in street/notes/queues/*.md; do
  base=$(basename "$qf" .md)
  [ "$base" = README ] && continue
  letter=${base%%-*}

  if [ ${#want[@]} -gt 0 ]; then
    hit=0; for w in "${want[@]}"; do [ "$w" = "$letter" ] && hit=1; done
    [ "$hit" = 1 ] || continue
  fi

  wt=$(grep -o 'worktree `\.\./[a-z0-9-]*`' "$qf" | head -1 | sed 's/.*\.\.\///;s/`//')
  port=$(grep -o 'port [0-9]*' "$qf" | head -1 | sed 's/port //')
  [ -n "$wt" ] || continue
  win=$(tmux list-panes -a -F '#{window_index} #{pane_current_path}' 2>/dev/null \
        | awk -v p="/home/erick/projects/$wt" '$2==p {print $1; exit}')
  [ -n "$win" ] || { echo "  $letter: no window, skipped"; continue; }

  # what the agent itself says it is doing — the only thing a compaction loses
  doing="(no status declared)"
  [ -f "street/notes/status/$letter" ] && doing=$(tr -d '\n' < "street/notes/status/$letter")

  # its own files, from the table that is the authority on them
  owns=$(awk -v a="$letter" '$0 ~ /^src\/proto\// && $3 == a {printf "%s ", $1}' street/notes/OWNERSHIP.md)
  [ -n "$owns" ] || owns="(see OWNERSHIP.md)"

  msg="Commit anything uncommitted right now, then run /compact and carry this forward verbatim as the summary. \
CARRY FORWARD: You are builder $letter on CROSSTOWN '97, worktree ../$wt, port ${port:-see your queue}. \
You own: $owns \
Your queue is street/notes/queues/$base.md and the desk writes it - read it, do not edit it. \
WHAT YOU WERE DOING when this compaction happened, in your own words: $doing \
STANDING RULES, all of which are written down so you do not have to remember them: \
run scripts/live.sh $letter for what the LEDGER still owes you - your queue says HOW, the ledger says WHETHER, and if the queue lists something live.sh does not then it is finished and you say so rather than build it twice. \
Keep street/notes/status/$letter current as ONE line, STATE | what I am on | who or what I am waiting on, where STATE is WORKING, BLOCKED or DONE - the desk has a live watch on it and BLOCKED is never a failure, an unreported block is. \
You may move your OWN ledger rows OPEN to LANDED, never CONFIRMED, never re-sort the table; and when you do, name the STATION - where a verifier should stand or what predicate settles it. \
If your own later work invalidates numbers in an evidence cell, republish them. \
When live.sh $letter is empty you become a VERIFIER of other people's LANDED rows, never your own. \
Read street/notes/GOTCHAS.md before your first change - it is the list of every way this project has already been got wrong. \
Then continue exactly where you left off."

  tmux send-keys -t "$SESSION:$win" C-u; sleep 0.3
  tmux send-keys -t "$SESSION:$win" "$msg"; sleep 1.0
  tmux send-keys -t "$SESSION:$win" Enter; sleep 0.5
  echo "  $letter (window $win): compacting — was: ${doing:0:70}"
  sent=$((sent + 1))
done

echo
echo "$sent agent(s) asked to commit and compact."
echo "Their queue files, LEDGER.md, OWNERSHIP.md and GOTCHAS.md are the memory;"
echo "notes/status/<agent> was the only thing at risk, and it went with them."
