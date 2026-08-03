#!/bin/sh
# Kill dev/preview servers left behind by agents that are no longer running.
#
# Usage:  ./scripts/reap-servers.sh [--dry] [live-agent-id ...]
#
# WHY. Every builder starts a vite dev server and usually a preview too, and a
# killed agent never stops them. By the end of one night 4177 and all of
# 4180-4199 were listening, ~86 vite processes, most of them orphans — and a
# builder that cannot find a free port either stops, or measures somebody else's
# world and reports confidently about it (GOTCHAS 48). "No free ports" is a
# fleet-wide outage that looks like nothing at all.
#
# WHAT IT SPARES. A server is reaped only when its command line names an agent
# worktree that is EITHER gone from disk OR not listed as live on the command
# line. Anything not running out of an agent worktree — the live integration
# world, a server the user started by hand — is never touched. Pass the ids of
# the agents you know are still working; get that list from
# `./scripts/claim.sh --stale`, which names every builder currently holding an
# item.
#
# NEVER `pkill -f vite`. The pattern matches this script's own command line, and
# the reaper kills itself partway through — which happened, and left the job
# half done with no error. Iterate over pids and skip our own.
set -u
cd "$(dirname "$0")/.." || exit 1

DRY=0
if [ "${1:-}" = "--dry" ]; then DRY=1; shift; fi
LIVE="$*"

ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || ROOT=$PWD

# NEVER REAP THE CALLER'S OWN WORKTREE. (Item 215.)
#
# This script spared everything outside an agent worktree and everything named
# on the command line -- and a builder running it from INSIDE its own worktree
# is neither. So the default invocation, `./scripts/reap-servers.sh` with no
# arguments, killed the caller's own preview.
#
# THAT IS NOT A HYPOTHETICAL AND IT COST A WHOLE MEASUREMENT. Worker sixtyseven
# lost its preview mid-sweep this way while building the jail containment check,
# and the sweep "happily reported 0 escapes about a world that was gone" -- a
# containment check reports success by finding NOTHING, which is exactly what a
# dead server produces. The sweep grew a dead-server guard because of it
# (w75-site-contained.mjs), and that guard should stay, because a server can die
# for reasons no script owns. But the reaper should not have been one of them.
#
# `$PWD` is this script's own directory's parent -- the `cd` above -- so for a
# copy of the script living in an agent worktree it contains that worktree's id.
# One line, and the no-argument case stops being a foot-gun.
SELF=$(printf '%s' "$PWD" | grep -oE 'agent-[a-f0-9]+' | head -1 | sed 's/agent-//')
[ -n "$SELF" ] && LIVE="$LIVE $SELF"

killed=0; spared=0

for pid in $(ps -eo pid,args | grep '[v]ite' | awk '{print $1}'); do
  [ "$pid" = "$$" ] && continue
  args=$(tr '\0' ' ' < "/proc/$pid/cmdline" 2>/dev/null) || continue
  [ -z "$args" ] && continue

  # Not an agent worktree? Not ours to reap.
  case "$args" in *worktrees/agent-*) ;; *) spared=$((spared + 1)); continue;; esac

  id=$(printf '%s' "$args" | grep -oE 'agent-[a-f0-9]+' | head -1 | sed 's/agent-//')
  [ -z "$id" ] && { spared=$((spared + 1)); continue; }

  keep=0
  for l in $LIVE; do [ "$id" = "$l" ] && keep=1; done
  # A worktree still on disk whose agent was not named as live is still an
  # orphan — agents outlive their servers, not the other way round. But a
  # worktree that is GONE is unambiguous, so say which case we are in.
  gone=0
  [ -d "$ROOT/.claude/worktrees/agent-$id" ] || gone=1

  if [ "$keep" = 1 ]; then
    spared=$((spared + 1))
    [ "$id" = "${SELF:-}" ] && [ "$DRY" = 1 ] && echo "sparing pid $pid — agent $id is US"
    continue
  fi

  if [ "$DRY" = 1 ]; then
    echo "would reap pid $pid — agent $id$([ "$gone" = 1 ] && echo ' (worktree gone)')"
  else
    kill "$pid" 2>/dev/null && killed=$((killed + 1))
  fi
done

[ "$DRY" = 1 ] && { echo "(dry run — spared $spared)"; exit 0; }
echo "reaped $killed; spared $spared"

# `ss -ltn`, NOT curl. This loop used to read `curl … %{http_code}` = 000 as
# "free", and 000 only means NOTHING SPOKE HTTP TO ME — a socket can be bound
# and listening without answering, e.g. a vite server still coming up. So the
# old count reported ports as free that a builder then could not bind, which is
# the failure this whole script exists to prevent, committed by the script's own
# report. Demonstrated on a bare TCP listener at 4239: `ss` says
# `LISTEN 0 511 127.0.0.1:4239`, `curl` says `000`. (GOTCHAS 81.)
#
# One `ss` call, not twenty curls: it also drops ~20 s of timeouts off the run.
listening=$(ss -ltn 2>/dev/null | awk '{print $4}' | grep -oE '[0-9]+$' | sort -u)
free=0
for p in $(seq 4180 4199); do
  printf '%s\n' "$listening" | grep -qx "$p" || free=$((free + 1))
done
echo "free ports in 4180-4199: $free of 20"
[ "$free" -lt 4 ] && echo "WARNING: the next builders will struggle — check for servers outside agent worktrees"
exit 0
