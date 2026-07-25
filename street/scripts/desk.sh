#!/usr/bin/env bash
# The desk's one status command. Prints ACTIONS, not a dashboard — if the
# ACTIONS list is empty there is nothing for the desk to do.
#
# Every check here exists because the desk got something wrong in front of the
# user and reported the opposite in good faith. In the order they happened:
#
#   1. ELEVEN COMMITS SAT UNLANDED for the better part of an hour because the
#      merge train was never run. → `scripts/desk-watch.sh` now lands on a
#      loop; this script still reports unlanded work.
#   2. SIX IDLE AGENTS READ AS BUSY. Claude Code renders greyed-out HINT text
#      in an idle agent's input box, which in a captured pane is
#      indistinguishable from an unsent message. The desk pressed Enter into
#      six empty boxes. → state comes from the spinner, never the input box.
#   3. THREE QUEUES WENT STALE — builders were handed work they had finished
#      hours earlier. B and C caught their own; D's had EIGHT landed items and
#      two listed twice. → `--verify` cross-checks queue items against
#      mainline; the report-newer-than-queue heuristic stays as a cheap hint.
#   4. AN AGENT GROUND FOR 74 MINUTES with nothing committed while the desk
#      read "busy" as healthy. It was attempting a refactor bundled into the
#      same item as a three-line fix. → STALL detection below.
#   5. A BUILDER SAT BLOCKED on an export another builder owned, and the desk
#      only found out by reading a handoff note. → BLOCKED protocol below.
#
# Usage:  scripts/desk.sh            status + actions
#         scripts/desk.sh --land     ...then run the merge train
#         scripts/desk.sh --verify   ...and check queue items against mainline
set -u
ROOT=/home/erick/projects
MAIN=$ROOT/rpg
BASE=add-stick-and-city98
SESSION=crosstown
MODE=${1:-}

# an agent working this long on one turn without committing is stuck, not busy
STALL_MIN=25

cd "$MAIN" || exit 1

pane_of() {
  tmux list-panes -a -F '#{window_index} #{pane_current_path}' 2>/dev/null \
    | awk -v p="$1" '$2==p {print $1; exit}'
}

# State from the SPINNER, never from the input box (failure 2).
# Match a truncation-safe prefix — narrow panes cut "esc to interrupt".
busy()    { tmux capture-pane -p -t "$SESSION:$1" 2>/dev/null | grep -qE 'esc to inter|…[[:space:]]*\((thinking|[0-9]+[ms])'; }
blocked() { tmux capture-pane -p -t "$SESSION:$1" 2>/dev/null | grep -q 'Do you want to proceed'; }

# How long has this turn been running? The spinner prints its own elapsed
# timer — "(1h 14m 12s · ↓ 92.5k tokens)" — which is exactly the number the
# desk needed and did not have when an agent ground for 74 minutes.
busy_minutes() {
  local t
  t=$(tmux capture-pane -p -t "$SESSION:$1" 2>/dev/null \
      | grep -oE '\(([0-9]+h )?[0-9]+m [0-9]+s' | tail -1 | tr -d '(')
  [ -z "$t" ] && { echo 0; return; }
  local h=0 m=0
  [[ "$t" =~ ([0-9]+)h ]] && h=${BASH_REMATCH[1]}
  [[ "$t" =~ ([0-9]+)m ]] && m=${BASH_REMATCH[1]}
  echo $(( h * 60 + m ))
}

declare -a ACTIONS=()
printf '%-12s %-8s %5s %4s %4s %-6s %s\n' AGENT STATE ONTURN UNL DIRTY QUEUE 'LAST COMMIT'
printf -- '---------------------------------------------------------------------------\n'

for wt in "$ROOT"/rpg-*; do
  [ -d "$wt" ] || continue
  name=$(basename "$wt"); short=${name#rpg-}
  seen_reps=()
  case "$name" in rpg-live) continue;; esac

  br=$(git -C "$wt" rev-parse --abbrev-ref HEAD 2>/dev/null) || continue
  ahead=$(git -C "$wt" log --oneline "$BASE..$br" 2>/dev/null | wc -l | tr -d ' ')
  dirty=$(git -C "$wt" status --porcelain 2>/dev/null | grep -vc node_modules)
  last=$(git -C "$wt" log -1 --format='%cr' 2>/dev/null)

  win=$(pane_of "$wt")
  mins=0
  if   [ -z "$win" ];      then state=NO-AGENT
  elif blocked "$win";     then state=BLOCKED
  elif busy "$win";        then state=busy; mins=$(busy_minutes "$win")
  else state=IDLE
  fi

  qf=$(grep -ls "worktree \`../$name\`" "$MAIN"/street/notes/queues/*.md 2>/dev/null | head -1)
  qopen=$( [ -n "$qf" ] && grep -c '^- \[ \]' "$qf" || echo '?' )

  printf '%-12s %-8s %5s %4s %4s %-6s %s\n' \
    "$short" "$state" "$( [ "$mins" -gt 0 ] && echo "${mins}m" || echo '-')" \
    "$ahead" "$dirty" "$qopen" "$last"

  [ "$state" = BLOCKED ] && ACTIONS+=("$short BLOCKED on a permission dialog — answer it (window $win)")
  [ "$state" = IDLE ] && [ "$qopen" != 0 ] && [ "$qopen" != '?' ] \
    && ACTIONS+=("$short IDLE with $qopen queued — dispatch it (window $win)")
  [ "$state" = IDLE ] && [ "$qopen" = 0 ] \
    && ACTIONS+=("$short IDLE and OUT OF WORK — give it a queue or retire it")

  # failure 4: busy is not the same as progressing
  if [ "$state" = busy ] && [ "$mins" -ge "$STALL_MIN" ] && [ "$ahead" -eq 0 ]; then
    ACTIONS+=("$short STALLED — ${mins}m on one turn with nothing committed. Interrupt it and ask for the SMALLEST committable piece (window $win)")
  fi

  [ "$ahead" -gt 0 ] && [ "$dirty" -eq 0 ] \
    && ACTIONS+=("$short has $ahead unlanded commits, clean tree — run scripts/land.sh")
  [ "$dirty" -gt 0 ] && [ "$state" = IDLE ] \
    && ACTIONS+=("$short IDLE with $dirty uncommitted files — finished but never committed; land.sh skips it")

  # failure 5: a builder blocked on someone else's file must not depend on the
  # desk happening to read a handoff note
  if [ -f "$MAIN/street/notes/BLOCKED-$short.md" ]; then
    ACTIONS+=("$short RAISED A BLOCKER — read street/notes/BLOCKED-$short.md and unblock it")
  fi

  if [ -n "$qf" ]; then
    # Match reports two ways. By WORKTREE name catches the ones called after
    # their topic (feat-traffic.md, audit-seams.md, D-alley-report.md); by the
    # QUEUE FILE's leading token catches the ones called after the builder
    # letter (A-shared.md -> A-toolchain.md, A-shopfronts.md).
    #
    # It used to be worktree-only, which meant this check silently did nothing
    # for any builder whose reports are named by letter. Builder A was exactly
    # that: its queue went stale for three sessions with a report newer than
    # the queue the whole time, and this — the countermeasure the README says
    # exists to catch precisely that — could not see it, because notes/*split2b*
    # matches no file. A staleness detector that is itself silently inert is
    # worse than none, because the desk reads a clean board and believes it.
    qpfx=$(basename "$qf"); qpfx=${qpfx%%-*}
    for rep in "$MAIN"/street/notes/*"$short"*.md "$MAIN"/street/notes/"$qpfx"-*.md; do
      [ -f "$rep" ] || continue
      case " ${seen_reps[*]} " in *" $rep "*) continue;; esac
      seen_reps+=("$rep")
      [ "$rep" -nt "$qf" ] && ACTIONS+=("$short: $(basename "$rep") is newer than its queue — read it, the queue may be stale")
    done
  fi
done

# failure 3: a queue item that is already on mainline is worse than useless —
# the builder re-reads it every cycle and the user's newest request queues
# behind finished work. This is a cheap heuristic, not proof: it looks for an
# open item whose bolded title also appears in a landed commit subject.
if [ "$MODE" = "--verify" ]; then
  echo
  echo "── queue items that look ALREADY LANDED ──"
  for qf in "$MAIN"/street/notes/queues/*.md; do
    [ -f "$qf" ] || continue
    grep -o '^- \[ \] \*\*[^*]*\*\*' "$qf" 2>/dev/null | sed 's/^- \[ \] \*\*//;s/\*\*$//' \
    | while read -r title; do
        key=$(echo "$title" | tr -d '.:—' | cut -c1-28)
        [ ${#key} -lt 10 ] && continue
        if git log --oneline -30 --format='%s' | grep -qiF "$key"; then
          echo "  ? $(basename "$qf"): \"$key\" appears in a recent commit subject"
        fi
      done
  done
fi

echo
if [ ${#ACTIONS[@]} -eq 0 ]; then
  echo "ACTIONS: none. Every agent is working, everything green is landed."
else
  echo "ACTIONS:"
  printf '  ! %s\n' "${ACTIONS[@]}"
fi
echo

[ "$MODE" = "--land" ] && { echo "── merge train ──"; "$MAIN/street/scripts/land.sh"; }
exit 0
