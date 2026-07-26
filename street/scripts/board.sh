#!/usr/bin/env bash
# THE BOARD — every worker, one line, at a glance. Is anyone blocked?
#
#   scripts/board.sh          the board
#   scripts/board.sh --bad    only rows that need the desk; silent if all well
#
# The user asked for this in as many words: *"i want you to be able to somehow
# know if any worker is blocked at any time. we should have statuses for the
# workers that update and that you at a glance can check to see what needs to
# be done."*
#
# WHY THIS IS NOT JUST `desk.sh`. desk.sh infers state from the OUTSIDE — is
# there a spinner, has it committed lately, is there a BLOCKED file. That
# catches a lot, and every check in it was paid for by a real failure. But
# inference cannot see the one thing that matters most: **an agent that knows
# it is stuck.** A builder waiting on another builder's export looks exactly
# like a builder thinking hard, and the desk has twice found out only by
# reading a handoff note an hour later.
#
# So each worker DECLARES its own state, and the board cross-checks the
# declaration against the outside evidence:
#
#     notes/status/<agent>          one line, rewritten whenever it changes
#     STATE | what I am on | who or what I am waiting on
#
#     STATE is one of:  WORKING  BLOCKED  DONE
#
# The declaration is what the worker believes. The tmux pane is what is
# actually true. **The interesting rows are where they disagree**, and the
# board says so rather than trusting either alone:
#
#   · says WORKING, no spinner, nothing committed for a while  → it died or
#     stalled mid-item and does not know
#   · says DONE but the ledger still has live rows             → it stopped
#     early; this is the "builders do one item and stop" failure
#   · says BLOCKED                                             → the desk owes
#     it a decision RIGHT NOW; this is the row that must never sit
#
# A status file nobody updates is worse than none, so a stale declaration is
# itself flagged: if the file has not been touched since well before the
# agent's last commit, the agent has moved on without saying so.
set -u
ROOT=/home/erick/projects
MAIN=$ROOT/rpg
SESSION=crosstown
ONLY_BAD=${1:-}
STALL_MIN=25

cd "$MAIN" || exit 1
S=street/notes/status
mkdir -p "$S"

pane_of() {
  tmux list-panes -a -F '#{window_index} #{pane_current_path}' 2>/dev/null \
    | awk -v p="$1" '$2==p {print $1; exit}'
}
busy() { tmux capture-pane -p -t "$SESSION:$1" 2>/dev/null \
         | grep -qE 'esc to inter|…[[:space:]]*\((thinking|[0-9]+[ms])'; }
dead() {
  local pane; pane=$(tmux capture-pane -p -t "$SESSION:$1" 2>/dev/null)
  [ -z "$pane" ] && return 0
  echo "$pane" | grep -qE 'auto mode on|accept edits|plan mode|bypass' && return 1
  echo "$pane" | grep -qE '\$ $|@[a-z]+:.*\$' && return 0
  return 1
}
permission() { tmux capture-pane -p -t "$SESSION:$1" 2>/dev/null | grep -q 'Do you want to proceed'; }

BAD=0
ROWS=()
say() { ROWS+=("$1"); }

for qf in street/notes/queues/*.md; do
  base=$(basename "$qf" .md)
  [ "$base" = "README" ] && continue
  letter=${base%%-*}
  wt=$(grep -o 'worktree `\.\./[a-z0-9-]*`' "$qf" | head -1 | sed 's/.*\.\.\///;s/`//')
  [ -z "$wt" ] && continue
  win=$(pane_of "$ROOT/$wt")

  # what the ledger still owes for this agent
  # `grep -c` prints 0 AND exits 1 when there is no match, so a `|| echo 0`
  # fallback appends a second zero and the row prints "0\n0". Let it stand alone.
  live=$(grep -cE "^\| OPEN \| $letter \|" street/notes/LEDGER.md 2>/dev/null); live=${live:-0}

  # minutes since its last commit
  last=$(git -C "$ROOT/$wt" log -1 --format=%ct 2>/dev/null || echo 0)
  now=$(date +%s)
  mins=$(( last > 0 ? (now - last) / 60 : 999 ))

  # the worker's own declaration
  decl="—"; what=""; waiting=""
  if [ -f "$S/$letter" ]; then
    IFS='|' read -r decl what waiting < "$S/$letter"
    decl=$(echo "$decl" | tr -d ' '); what=$(echo "$what" | sed 's/^ *//;s/ *$//')
    waiting=$(echo "$waiting" | sed 's/^ *//;s/ *$//')
  fi

  # outside truth
  if   [ -z "$win" ];        then outside="NOWINDOW"
  elif dead "$win";          then outside="DEAD"
  elif permission "$win";    then outside="PROMPT"
  elif busy "$win";          then outside="running"
  else                            outside="idle"; fi

  flag=""
  case "$decl" in
    BLOCKED) flag="BLOCKED — needs a desk decision: ${waiting:-unspecified}";;
    # DONE with live rows means STOPPED EARLY — but only if it has actually
    # stopped. A worker dispatched a moment ago is running on the new row and
    # simply has not rewritten its line yet, and flagging that fires an alert
    # the desk can do nothing about. Believe the pane over the declaration in
    # both directions: idle is what makes DONE a problem.
    DONE)    [ "$live" -gt 0 ] && [ "$outside" = idle ] \
               && flag="says DONE but $live live rows remain — it stopped early";;
    WORKING) [ "$outside" = idle ] && [ "$mins" -ge "$STALL_MIN" ] \
               && flag="says WORKING, not running, nothing committed for ${mins}m — died or stalled mid-item";;
    —)       flag="has never declared a status — cannot be trusted to say when it is stuck";;
  esac
  # outside evidence overrides anything the worker claims
  [ "$outside" = DEAD ]     && flag="SESSION IS DEAD — restart it"
  [ "$outside" = NOWINDOW ] && flag="no tmux window — not running at all"
  [ "$outside" = PROMPT ]   && flag="waiting on a PERMISSION DIALOG — answer it"
  # a declaration nobody maintains is a declaration that lies
  if [ -f "$S/$letter" ] && [ -z "$flag" ]; then
    sm=$(( (now - $(stat -c %Y "$S/$letter")) / 60 ))
    [ "$sm" -gt 90 ] && [ "$mins" -lt 30 ] \
      && flag="status is ${sm}m old but it committed ${mins}m ago — declaration is stale"
  fi

  [ -n "$flag" ] && BAD=$((BAD + 1))
  printf -v row '%-9s %-8s %-8s %3s live %4sm  %s' \
    "$letter" "$decl" "$outside" "$live" "$mins" "${flag:+<< $flag}"
  [ -z "$flag" ] && row="$row${what:+  · $what}"
  say "$row"
done

if [ "$ONLY_BAD" = "--bad" ]; then
  [ "$BAD" = 0 ] && exit 0
  echo "WORKERS NEEDING THE DESK:"
  printf '%s\n' "${ROWS[@]}" | grep '<<'
  exit 0
fi

echo
echo "AGENT     SAYS     ACTUALLY   LIVE  LASTCOMMIT"
echo "--------------------------------------------------------------------------"
printf '%s\n' "${ROWS[@]}"
echo
if [ "$BAD" = 0 ]; then
  echo "Nothing needs the desk. Every worker is running or honestly resting."
else
  echo "$BAD worker(s) need the desk — the rows marked <<."
fi
echo
echo "SAYS is the worker's own word (notes/status/<agent>); ACTUALLY is the"
echo "tmux pane. Where they disagree, believe ACTUALLY and fix the worker."
echo
