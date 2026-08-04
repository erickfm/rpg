#!/bin/sh
# A ROTATING SNAPSHOT OF notes/QUEUE.md, TAKEN UNDER THE LOCK THAT IS ALREADY HELD.
#
# WHY THIS EXISTS, in the desk's own words on the day it was filed (2026-08-02):
# *"THE QUEUE HAS NO BACKUP AND IS UNTRACKED, WHICH IS THE WORST OF BOTH
# WORLDS."* An aborted merge deleted the file outright and everything the desk
# had written on ~45 open rows went with it.
#
# The untracking was RIGHT and is not reopened here. `0d1e61de5` untracked
# QUEUE.md because ordinary git merges were silently reverting builders' DONE
# rows — a builder marked an item done, a merge from another worktree carried an
# older copy of the file, and the row went back to DOING with nobody told. That
# is a worse failure than losing the file, because it is silent. So: no
# re-tracking. What was missing was the other half — a copy that is not a merge
# participant.
#
# THE SNAPSHOT IS TAKEN ON LOCK RELEASE, NOT BY A CALLER REMEMBERING TO CALL IT.
# `claim.sh`, `done.sh` and `add.sh` each already own the queue exclusively for
# the length of one operation and each already has a
# `trap '…' EXIT INT TERM` that gives the lock back. Hanging the copy off that
# trap means every path out of every one of them — success, usage error,
# Ctrl-C, a `set -u` blow-up — snapshots on the way past, and there is no
# fourth caller that could forget. That is the whole design, and it is why this
# is four lines in each script rather than a discipline.
#
#   queue-backup.sh snapshot [<queue>]   take one, dedupe, prune. ALWAYS exit 0.
#   queue-backup.sh --latest [<queue>]   print the newest snapshot's path
#   queue-backup.sh --list   [<queue>]   every snapshot, newest first
#   queue-backup.sh --restore [<queue>]  copy the newest snapshot back over the queue
#   queue-backup.sh --selftest           prove all three scripts really write one
#
# `snapshot` NEVER FAILS ITS CALLER. It is running inside a trap, after the work
# the builder cares about, and a backup that can take a claim down with it is
# worse than no backup. Every failure path in it exits 0 on purpose; the modes a
# human runs (`--latest`, `--restore`, `--selftest`) exit non-zero properly.
set -u

# How many to keep. A queue snapshot is a few KB, so 200 is well under a
# megabyte and covers a whole day of a five-agent fleet.
KEEP=${QUEUE_BACKUP_KEEP:-200}

# The queue path, resolved exactly the way claim.sh/done.sh/add.sh resolve it —
# `git rev-parse --git-common-dir` points at the shared .git for the whole repo,
# worktrees included, which is the one scope the queue may live in. An explicit
# argument wins, so the three callers pass the `$Q` they are already holding and
# cannot drift from it.
resolve_q() {
  if [ -n "${1:-}" ]; then printf '%s\n' "$1"; return 0; fi
  if [ -n "${CLAIM_QUEUE:-}" ]; then printf '%s\n' "$CLAIM_QUEUE"; return 0; fi
  _c=$(git rev-parse --git-common-dir 2>/dev/null) || _c=.git
  case "$_c" in /*) ;; *) _c="$PWD/$_c";; esac
  printf '%s\n' "$(dirname "$_c")/street/notes/QUEUE.md"
}

mode=${1:-snapshot}
case "$mode" in
  snapshot|--latest|--list|--restore|--selftest) ;;
  *) echo "usage: queue-backup.sh [snapshot|--latest|--list|--restore|--selftest] [queue-path]" >&2; exit 2;;
esac

# ── the selftest lives at the bottom; it re-enters this script ─────────────
if [ "$mode" = "--selftest" ]; then
  SELFTEST=1
else
  SELFTEST=0
fi

Q=$(resolve_q "${2:-}")
DIR=$(dirname "$Q")/.queue-history
snaps() { ls -1 "$DIR" 2>/dev/null | grep '^QUEUE-[0-9]' | sort; }

if [ "$mode" = "snapshot" ]; then
  # An empty or absent queue is not a state worth preserving, and copying one
  # over the history would be the backup destroying the evidence.
  [ -s "$Q" ] || exit 0
  mkdir -p "$DIR" 2>/dev/null || exit 0
  # DEDUPE. `claim.sh --stale` and every usage error take the lock and change
  # nothing; without this the history fills with 200 identical copies and the
  # oldest real state falls off the end. `cmp` against the newest is one syscall
  # per release.
  newest=$(snaps | tail -1)
  if [ -n "$newest" ] && cmp -s "$Q" "$DIR/$newest"; then exit 0; fi
  # write-then-rename, so a snapshot is never half a file
  tmp="$DIR/.writing-$$"
  cp "$Q" "$tmp" 2>/dev/null || { rm -f "$tmp" 2>/dev/null; exit 0; }
  # epoch is fixed-width until 2286 and the pid is padded, so a plain `sort`
  # is chronological. Both are needed: two callers can release inside one second.
  mv "$tmp" "$DIR/QUEUE-$(date '+%s')-$(printf '%05d' $$).md" 2>/dev/null \
    || { rm -f "$tmp" 2>/dev/null; exit 0; }
  n=$(snaps | wc -l | tr -d ' ')
  if [ "$n" -gt "$KEEP" ]; then
    snaps | head -n $((n - KEEP)) | while read -r f; do rm -f "$DIR/$f"; done
  fi
  exit 0
fi

if [ "$mode" = "--latest" ]; then
  f=$(snaps | tail -1)
  [ -z "$f" ] && { echo "no snapshots under $DIR" >&2; exit 1; }
  printf '%s\n' "$DIR/$f"
  exit 0
fi

if [ "$mode" = "--list" ]; then
  f=$(snaps)
  [ -z "$f" ] && { echo "no snapshots under $DIR" >&2; exit 1; }
  echo "$DIR"
  printf '%s\n' "$f" | sort -r | while read -r s; do
    printf '  %s  %s rows  %s\n' \
      "$s" \
      "$(grep -c '^| *[0-9]' "$DIR/$s" 2>/dev/null || echo '?')" \
      "$(date -d "@$(printf '%s' "$s" | sed 's/^QUEUE-\([0-9]*\)-.*/\1/')" '+%H:%M:%S' 2>/dev/null || echo '')"
  done
  exit 0
fi

if [ "$mode" = "--restore" ]; then
  f=$(snaps | tail -1)
  [ -z "$f" ] && { echo "no snapshots under $DIR — nothing to restore from" >&2; exit 1; }
  # TAKE THE LOCK. A restore runs while the fleet may be mid-claim, and writing
  # the queue outside the lock is the race every other line of this system is
  # built to avoid.
  LOCK="$(dirname "$Q")/.queue.lock"
  tries=0
  until mkdir "$LOCK" 2>/dev/null; do
    tries=$((tries + 1))
    [ "$tries" -gt 60 ] && { echo "queue locked for 60s — taking it" >&2; rm -rf "$LOCK"; mkdir "$LOCK" 2>/dev/null || exit 1; break; }
    sleep 1
  done
  trap 'rm -rf "$LOCK"' EXIT INT TERM
  # The queue that is there NOW goes into the history first, whatever state it
  # is in. Restoring must not be the operation that destroys the evidence of
  # what went wrong.
  if [ -s "$Q" ]; then cp "$Q" "$DIR/QUEUE-$(date '+%s')-$(printf '%05d' $$).md" 2>/dev/null; fi
  cp "$DIR/$f" "$Q" || { echo "restore failed" >&2; exit 1; }
  echo "restored $Q from $f  ($(grep -c '^| *[0-9]' "$Q") rows)"
  exit 0
fi

# ══ --selftest ════════════════════════════════════════════════════════════
#
# GOTCHAS §27: a check you have never watched fail is a check you will argue
# with. So this does not assert "the code looks right" — it runs the three real
# scripts against a scratch queue and asserts a snapshot appeared from each, and
# then does the thing the item was filed about: deletes the queue and restores
# it, checking that what comes back is the state after the last operation.
[ "$SELFTEST" = 1 ] || exit 0

here=$(cd "$(dirname "$0")" && pwd)
tmp=$(mktemp -d) || { echo "cannot make a scratch dir"; exit 1; }
trap 'rm -rf "$tmp"' EXIT INT TERM
SQ="$tmp/QUEUE.md"
SDIR="$tmp/.queue-history"
cat > "$SQ" <<'EOF'
# scratch queue — queue-backup.sh --selftest

| id | state | file(s) | what |
|---|---|---|---|
| 900 | TODO | scripts/queue-backup.sh | a row the selftest claims |
| 901 | TODO | scripts/queue-backup.sh | a second row, never touched |
EOF

fails=0
say() { printf '  %-6s %s\n' "$1" "$2"; }
count() { ls -1 "$SDIR" 2>/dev/null | grep -c '^QUEUE-[0-9]' | tr -d ' '; }

echo
echo "  queue-backup --selftest   scratch queue at $SQ"
echo

before=$(count)
CLAIM_QUEUE="$SQ" sh "$here/claim.sh" selftest-bot >/dev/null 2>&1
after=$(count)
if [ "$after" -gt "$before" ]; then say OK "claim.sh wrote a snapshot ($before -> $after)"
else say FAIL "claim.sh wrote NO snapshot ($before -> $after)"; fails=$((fails + 1)); fi

before=$after
CLAIM_QUEUE="$SQ" sh "$here/done.sh" selftest-bot "a note" >/dev/null 2>&1
after=$(count)
if [ "$after" -gt "$before" ]; then say OK "done.sh wrote a snapshot ($before -> $after)"
else say FAIL "done.sh wrote NO snapshot ($before -> $after)"; fails=$((fails + 1)); fi

before=$after
CLAIM_QUEUE="$SQ" sh "$here/add.sh" 902 scripts/queue-backup.sh "a row the selftest added" >/dev/null 2>&1
after=$(count)
if [ "$after" -gt "$before" ]; then say OK "add.sh wrote a snapshot ($before -> $after)"
else say FAIL "add.sh wrote NO snapshot ($before -> $after)"; fails=$((fails + 1)); fi

# THE DEDUPE, watched rather than assumed: a second read-only release must NOT
# add a copy, or 200 slots of history become 200 copies of one minute.
before=$after
CLAIM_QUEUE="$SQ" sh "$here/claim.sh" --stale >/dev/null 2>&1
after=$(count)
if [ "$after" -eq "$before" ]; then say OK "an unchanged release adds nothing ($after)"
else say FAIL "an unchanged release added a snapshot ($before -> $after)"; fails=$((fails + 1)); fi

# ── AND THE THING THE ITEM WAS ACTUALLY FILED ABOUT ───────────────────────
live=$(cat "$SQ")
rm -f "$SQ"                                    # the merge that ate the queue
if [ -f "$SQ" ]; then say FAIL "could not delete the scratch queue"; fails=$((fails + 1)); fi
sh "$here/queue-backup.sh" --restore "$SQ" >/dev/null 2>&1
if [ ! -s "$SQ" ]; then
  say FAIL "restore produced no queue"; fails=$((fails + 1))
elif [ "$(cat "$SQ")" = "$live" ]; then
  say OK "destroyed and restored — ZERO operations lost"
else
  say FAIL "restored content differs from the last live state"; fails=$((fails + 1))
  diff "$SQ" - <<EOF || true
$live
EOF
fi

# A RESTORE MUST NOT BE THE OPERATION THAT DESTROYS THE EVIDENCE. The delete
# case above has nothing to preserve, so it proves nothing about this; the case
# that does is a queue that is still THERE and wrong — half-merged, truncated,
# conflict-marked — which is the likelier shape of the next incident. First
# written as an assertion on the delete case and it failed, correctly: there was
# no state to keep. Watching it fail is what found the wrong subject (§27).
after=$(count)
printf '<<<<<<< a half-merged queue\n' > "$SQ"
sh "$here/queue-backup.sh" --restore "$SQ" >/dev/null 2>&1
if [ "$(count)" -gt "$after" ] && [ "$(cat "$SQ")" = "$live" ]; then
  say OK "restoring OVER a broken queue files the broken one first"
else
  say FAIL "the restore did not keep the state it overwrote ($after -> $(count))"; fails=$((fails + 1))
fi

echo
if [ "$fails" -eq 0 ]; then echo "  all good — $(count) snapshots taken during the run"; exit 0; fi
echo "  $fails FAILED"; exit 1

# CAP THE SNAPSHOTS. This ran on every claim/done/add and had reached 200 files
# and 28 MB — a safety net that grows without bound stops being a safety net and
# becomes the thing you have to clean up. Twenty is far more than the one you
# ever actually want, which is the snapshot from just before the last mistake.
KEEP_LAST=20
D="$(dirname "${Q:-notes/QUEUE.md}")/.queue-history"
[ -d "$D" ] && ls -1t "$D" 2>/dev/null | tail -n +$((KEEP_LAST + 1)) | while read -r f; do rm -f "$D/$f"; done
